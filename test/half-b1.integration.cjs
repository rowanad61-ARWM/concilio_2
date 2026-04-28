require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const authMockPath = path.join(__dirname, "mocks", "auth.cjs");
const originalResolveFilename = Module._resolveFilename;

function resolveAlias(request) {
  const relative = request.slice(2);
  const base = path.join(rootDir, "src", relative);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`Unable to resolve alias ${request}`);
  }

  return match;
}

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@/auth") {
    return authMockPath;
  }

  if (request.startsWith("@/")) {
    return resolveAlias(request);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const testDb = global.__CONCILIO_TEST_DATABASE__;
console.log(
  `[integration] DATABASE_URL resolved to ${testDb.redactedUrl} (host=${testDb.hostname}, database=${testDb.database})`,
);

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_EMAIL = "round1-b1-audit-smoke@example.test";

function jsonRequest(url, method, body, requestId) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "ConcilioHalfB1Integration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

function contextFor(id) {
  return { params: Promise.resolve({ id }) };
}

async function expectJson(response, expectedStatus) {
  const text = await response.text();
  let body = null;

  if (text) {
    body = JSON.parse(text);
  }

  assert.equal(response.status, expectedStatus, text);
  return body;
}

async function main() {
  const { db } = require("../src/lib/db.ts");
  const { hardDeleteParty } = require("../src/lib/partyDelete.ts");
  const clientsRoute = require("../src/app/api/clients/route.ts");
  const clientRoute = require("../src/app/api/clients/[id]/route.ts");

  await db.practice.upsert({
    where: { code: "TEST" },
    update: { name: "Concilio Test Practice", status: "active" },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Concilio Test Practice",
      code: "TEST",
      status: "active",
    },
  });

  await db.user_account.upsert({
    where: { email: ACTOR_EMAIL },
    update: {
      id: ACTOR_ID,
      name: "Round 1 B1 Smoke Actor",
      status: "active",
      role: "adviser",
      practice_id: "22222222-2222-4222-8222-222222222222",
    },
    create: {
      id: ACTOR_ID,
      practice_id: "22222222-2222-4222-8222-222222222222",
      name: "Round 1 B1 Smoke Actor",
      email: ACTOR_EMAIL,
      role: "adviser",
      status: "active",
    },
  });

  const requestIds = {
    create: `half-b1-create-${Date.now()}`,
    update: `half-b1-update-${Date.now()}`,
    delete: `half-b1-delete-${Date.now()}`,
    failed: `half-b1-failed-${Date.now()}`,
  };

  let clientId = null;
  let deletedThroughRoute = false;

  try {
    const createResponse = await clientsRoute.POST(
      jsonRequest(
        "http://localhost/api/clients",
        "POST",
        {
          firstName: "Round",
          lastName: "Smoke",
          preferredName: "B1",
          dateOfBirth: "1980-01-02",
          email: "round.b1.smoke@example.test",
          mobile: "0400000000",
          relationshipStatus: "single",
          countryOfResidence: "AU",
        },
        requestIds.create,
      ),
    );
    const created = await expectJson(createResponse, 200);
    assert.equal(typeof created.id, "string");
    clientId = created.id;

    const updateResponse = await clientRoute.PATCH(
      jsonRequest(
        `http://localhost/api/clients/${clientId}`,
        "PATCH",
        {
          firstName: "Round",
          lastName: "Smoke Updated",
          preferredName: "B1 Updated",
          mobile: "0499999999",
        },
        requestIds.update,
      ),
      contextFor(clientId),
    );
    const updated = await expectJson(updateResponse, 200);
    assert.equal(updated.id, clientId);
    assert.equal(updated.displayName, "Round Smoke Updated");

    const failedResponse = await clientsRoute.POST(
      jsonRequest(
        "http://localhost/api/clients",
        "POST",
        {
          firstName: "Invalid",
        },
        requestIds.failed,
      ),
    );
    await expectJson(failedResponse, 400);

    const deleteResponse = await clientRoute.DELETE(
      new Request(`http://localhost/api/clients/${clientId}`, {
        method: "DELETE",
        headers: {
          "user-agent": "ConcilioHalfB1Integration/1.0",
          "x-forwarded-for": "127.0.0.1",
          "x-request-id": requestIds.delete,
        },
      }),
      contextFor(clientId),
    );
    const deleted = await expectJson(deleteResponse, 200);
    assert.equal(deleted.success, true);
    deletedThroughRoute = true;

    const eventChain = await db.audit_event.findMany({
      where: {
        subject_id: clientId,
        event_type: {
          in: ["CREATE", "UPDATE", "DELETE"],
        },
      },
      orderBy: { occurred_at: "asc" },
      select: {
        event_type: true,
        subject_type: true,
        subject_id: true,
        request_id: true,
        actor_ip: true,
        actor_user_agent: true,
        before_snapshot: true,
        after_snapshot: true,
        details: true,
      },
    });

    assert.deepEqual(
      eventChain.map((event) => event.event_type),
      ["CREATE", "UPDATE", "DELETE"],
    );
    assert.deepEqual(
      eventChain.map((event) => event.subject_type),
      ["person", "person", "person"],
    );
    assert.deepEqual(
      eventChain.map((event) => event.request_id),
      [requestIds.create, requestIds.update, requestIds.delete],
    );
    assert.equal(eventChain.every((event) => event.actor_ip === "127.0.0.1"), true);
    assert.equal(
      eventChain.every(
        (event) => event.actor_user_agent === "ConcilioHalfB1Integration/1.0",
      ),
      true,
    );
    assert.equal(eventChain[0].before_snapshot, null);
    assert.equal(Boolean(eventChain[0].after_snapshot), true);
    assert.equal(Boolean(eventChain[1].before_snapshot), true);
    assert.equal(Boolean(eventChain[1].after_snapshot), true);
    assert.equal(Boolean(eventChain[2].before_snapshot), true);
    assert.equal(eventChain[2].after_snapshot, null);
    assert.equal(Boolean(eventChain[2].details?.metadata?.cascaded), true);

    const failedAuditCount = await db.audit_event.count({
      where: { request_id: requestIds.failed },
    });
    assert.equal(failedAuditCount, 0);

    const remainingParty = await db.party.findUnique({ where: { id: clientId } });
    assert.equal(remainingParty, null);

    console.log("[integration] Half B1 event chain:");
    for (const event of eventChain) {
      console.log(
        `  ${event.event_type} ${event.subject_type}/${event.subject_id} request_id=${event.request_id}`,
      );
    }
    console.log("[integration] Failed validation produced 0 audit_event rows.");
  } finally {
    if (clientId && !deletedThroughRoute) {
      try {
        await hardDeleteParty(clientId, ACTOR_ID);
      } catch (error) {
        console.error(`[integration] Cleanup failed for client ${clientId}:`, error);
      }
    }

    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

