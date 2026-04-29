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
      "user-agent": "ConcilioTu4Integration/1.0",
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
  const body = text ? JSON.parse(text) : null;

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

  const createdIds = [];

  async function createClient(label) {
    const requestId = `tu4-create-${label}-${Date.now()}`;
    const response = await clientsRoute.POST(
      jsonRequest(
        "http://localhost/api/clients",
        "POST",
        {
          firstName: "Tu",
          lastName: `Four ${label}`,
          preferredName: "TU4",
          dateOfBirth: "1984-04-04",
          email: `tu4.${label}.${Date.now()}@example.test`,
          mobile: "0400000000",
          relationshipStatus: "single",
          countryOfResidence: "AU",
        },
        requestId,
      ),
    );
    const body = await expectJson(response, 200);
    createdIds.push(body.id);
    return body.id;
  }

  try {
    const emptyClientId = await createClient("empty");
    const emptyPatchResponse = await clientRoute.PATCH(
      jsonRequest(
        `http://localhost/api/clients/${emptyClientId}`,
        "PATCH",
        {
          relationshipStatus: "",
        },
        `tu4-empty-${Date.now()}`,
      ),
      contextFor(emptyClientId),
    );
    await expectJson(emptyPatchResponse, 200);

    const emptyRow = await db.person.findUnique({
      where: { id: emptyClientId },
      select: { relationship_status: true },
    });
    assert.equal(emptyRow.relationship_status, null);
    console.log("ok - PATCH empty relationshipStatus stores NULL");

    const validClientId = await createClient("valid");
    const validPatchResponse = await clientRoute.PATCH(
      jsonRequest(
        `http://localhost/api/clients/${validClientId}`,
        "PATCH",
        {
          relationshipStatus: "married",
        },
        `tu4-valid-${Date.now()}`,
      ),
      contextFor(validClientId),
    );
    await expectJson(validPatchResponse, 200);

    const validRow = await db.person.findUnique({
      where: { id: validClientId },
      select: { relationship_status: true },
    });
    assert.equal(validRow.relationship_status, "married");
    console.log("ok - PATCH valid relationshipStatus stores value");
  } finally {
    for (const clientId of createdIds.reverse()) {
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
