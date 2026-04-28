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
const PRACTICE_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = `${Date.now()}`;

function jsonRequest(url, method, body, requestId) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "ConcilioHalfCIntegration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

function emptyRequest(url, method, requestId) {
  return new Request(url, {
    method,
    headers: {
      "user-agent": "ConcilioHalfCIntegration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
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
  const adminAlertRoute = require("../src/app/api/admin/alerts/[id]/route.ts");

  await db.practice.upsert({
    where: { code: "TEST" },
    update: { name: "Concilio Test Practice", status: "active" },
    create: {
      id: PRACTICE_ID,
      name: "Concilio Test Practice",
      code: "TEST",
      status: "active",
    },
  });

  await db.user_account.upsert({
    where: { email: ACTOR_EMAIL },
    update: {
      id: ACTOR_ID,
      name: "Round 1 Half C Admin Actor",
      status: "active",
      role: "owner",
      practice_id: PRACTICE_ID,
    },
    create: {
      id: ACTOR_ID,
      practice_id: PRACTICE_ID,
      name: "Round 1 Half C Admin Actor",
      email: ACTOR_EMAIL,
      role: "owner",
      status: "active",
    },
  });

  const requestIds = {
    create: `half-c-create-${RUN_ID}`,
    update: `half-c-update-${RUN_ID}`,
    acknowledge: `half-c-acknowledge-${RUN_ID}`,
  };

  let clientId = null;
  const alertIds = [];

  try {
    const createResponse = await clientsRoute.POST(
      jsonRequest(
        "http://localhost/api/clients",
        "POST",
        {
          firstName: "Half",
          lastName: "Alert",
          preferredName: "HC",
          dateOfBirth: "1982-03-04",
          email: `half-c-old-${RUN_ID}@example.test`,
          mobile: "0400000001",
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
          firstName: "Half",
          lastName: "Alert",
          preferredName: "HC",
          email: `half-c-new-${RUN_ID}@example.test`,
          mobile: "0400000001",
          relationshipStatus: "single",
          countryOfResidence: "AU",
        },
        requestIds.update,
      ),
      contextFor(clientId),
    );
    const updated = await expectJson(updateResponse, 200);
    assert.equal(updated.id, clientId);

    const updateAuditEvent = await db.audit_event.findFirst({
      where: {
        request_id: requestIds.update,
        event_type: "UPDATE",
        subject_type: "person",
        subject_id: clientId,
      },
      select: {
        id: true,
        before_snapshot: true,
        after_snapshot: true,
      },
    });

    assert.ok(updateAuditEvent, "expected UPDATE audit_event for email change");

    const alertRows = await db.alert_instance.findMany({
      where: {
        audit_event_id: updateAuditEvent.id,
        alert_type: "FIELD_CHANGE",
        entity_type: "person",
        entity_id: clientId,
        acknowledged_at: null,
      },
      orderBy: { occurred_at: "desc" },
    });

    assert.equal(alertRows.length, 1);
    const alert = alertRows[0];
    alertIds.push(alert.id);
    assert.deepEqual(alert.payload, {
      field: "email",
      old: `half-c-old-${RUN_ID}@example.test`,
      new: `half-c-new-${RUN_ID}@example.test`,
    });

    const acknowledgeResponse = await adminAlertRoute.PATCH(
      emptyRequest(
        `http://localhost/api/admin/alerts/${alert.id}`,
        "PATCH",
        requestIds.acknowledge,
      ),
      contextFor(alert.id),
    );
    const acknowledged = await expectJson(acknowledgeResponse, 200);
    assert.equal(acknowledged.alert.id, alert.id);
    assert.equal(acknowledged.alert.acknowledged_by_user_id, ACTOR_ID);

    const storedAlert = await db.alert_instance.findUnique({
      where: { id: alert.id },
      select: {
        acknowledged_at: true,
        acknowledged_by_user_id: true,
      },
    });
    assert.ok(storedAlert?.acknowledged_at, "expected acknowledged_at to be set");
    assert.equal(storedAlert.acknowledged_by_user_id, ACTOR_ID);

    const outstandingCount = await db.alert_instance.count({
      where: {
        id: alert.id,
        acknowledged_at: null,
      },
    });
    assert.equal(outstandingCount, 0);

    const acknowledgeAuditEvent = await db.audit_event.findFirst({
      where: {
        request_id: requestIds.acknowledge,
        event_type: "UPDATE",
        subject_type: "alert_instance",
        subject_id: alert.id,
      },
      select: {
        id: true,
        before_snapshot: true,
        after_snapshot: true,
      },
    });

    assert.ok(acknowledgeAuditEvent, "expected audit_event for alert acknowledgement");
    assert.equal(
      acknowledgeAuditEvent.before_snapshot.acknowledged_at,
      null,
      "expected pre-ack snapshot to be unacknowledged",
    );
    assert.ok(
      acknowledgeAuditEvent.after_snapshot.acknowledged_at,
      "expected post-ack snapshot to include acknowledged_at",
    );

    console.log("[integration] Half C alert flow:");
    console.log(`  UPDATE audit_event=${updateAuditEvent.id}`);
    console.log(`  FIELD_CHANGE alert_instance=${alert.id}`);
    console.log(`  ACK audit_event=${acknowledgeAuditEvent.id}`);
  } finally {
    if (alertIds.length > 0) {
      await db.alert_instance.deleteMany({
        where: { id: { in: alertIds } },
      });
    }

    if (clientId) {
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
