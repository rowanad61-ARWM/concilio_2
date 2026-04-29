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
      "user-agent": "ConcilioRound2HalfCIntegration/1.0",
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
      "user-agent": "ConcilioRound2HalfCIntegration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
  });
}

function contextFor(id) {
  return { params: Promise.resolve({ id }) };
}

function rowContext(id, rowId) {
  return { params: Promise.resolve({ id, rowId }) };
}

async function expectJson(response, expectedStatus) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  assert.equal(response.status, expectedStatus, text);
  return body;
}

async function expectAuditEvent(db, requestId, subjectType) {
  const event = await db.audit_event.findFirst({
    where: {
      request_id: requestId,
      subject_type: subjectType,
    },
  });

  assert.ok(event, `expected audit_event for ${subjectType} request ${requestId}`);
  return event;
}

async function main() {
  const { db } = require("../src/lib/db.ts");
  const { hardDeleteParty } = require("../src/lib/partyDelete.ts");
  const clientsRoute = require("../src/app/api/clients/route.ts");
  const accountCollection = require("../src/app/api/clients/[id]/super-pension-accounts/route.ts");
  const accountRow = require("../src/app/api/clients/[id]/super-pension-accounts/[rowId]/route.ts");

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

  let clientId = null;

  try {
    const createdClient = await expectJson(
      await clientsRoute.POST(
        jsonRequest(
          "http://localhost/api/clients",
          "POST",
          {
            firstName: "Halfc",
            lastName: "Client",
            dateOfBirth: "1978-04-04",
            email: `round2c.${Date.now()}@example.test`,
            relationshipStatus: "single",
            countryOfResidence: "AU",
          },
          `r2hc-create-client-${Date.now()}`,
        ),
      ),
      200,
    );
    clientId = createdClient.id;

    await expectJson(
      await accountCollection.POST(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts`,
          "POST",
          { providerName: "Aware Super" },
          `r2hc-missing-account-type-${Date.now()}`,
        ),
        contextFor(clientId),
      ),
      400,
    );
    console.log("ok - super_pension_account rejects missing account_type");

    await expectJson(
      await accountCollection.POST(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts`,
          "POST",
          { accountType: "super" },
          `r2hc-missing-provider-${Date.now()}`,
        ),
        contextFor(clientId),
      ),
      400,
    );
    console.log("ok - super_pension_account rejects missing provider_name");

    await expectJson(
      await accountCollection.POST(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts`,
          "POST",
          { accountType: "crypto_super", providerName: "Aware Super" },
          `r2hc-invalid-account-type-${Date.now()}`,
        ),
        contextFor(clientId),
      ),
      400,
    );
    console.log("ok - super_pension_account rejects invalid account_type");

    const createRequestId = `r2hc-account-create-${Date.now()}`;
    const created = await expectJson(
      await accountCollection.POST(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts`,
          "POST",
          {
            accountType: "super",
            providerName: "Aware Super",
            productName: "Accumulation",
            memberNumber: "MEM-123",
            currentBalance: "12345.67",
            balanceAsAt: "2026-04-30",
            beneficiaryNominationType: "binding",
            contributionsYtd: "1500.00",
          },
          createRequestId,
        ),
        contextFor(clientId),
      ),
      200,
    );
    assert.ok(created.id);
    assert.equal(created.account_type, "super");
    assert.equal(created.provider_name, "Aware Super");
    assert.equal(created.current_balance, "12345.67");
    await expectAuditEvent(db, createRequestId, "super_pension_account");

    const list = await expectJson(
      await accountCollection.GET(
        emptyRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts`,
          "GET",
          `r2hc-account-list-${Date.now()}`,
        ),
        contextFor(clientId),
      ),
      200,
    );
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].id, created.id);
    console.log("ok - super_pension_account POST and GET");

    await expectJson(
      await accountRow.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts/${created.id}`,
          "PATCH",
          { beneficiaryNominationType: "made_up" },
          `r2hc-invalid-nomination-${Date.now()}`,
        ),
        rowContext(clientId, created.id),
      ),
      400,
    );
    console.log("ok - super_pension_account rejects invalid beneficiary_nomination_type");

    const providerPatchRequestId = `r2hc-provider-patch-${Date.now()}`;
    const providerPatched = await expectJson(
      await accountRow.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts/${created.id}`,
          "PATCH",
          {
            providerName: "Future Fund",
            memberNumber: "MEM-456",
          },
          providerPatchRequestId,
        ),
        rowContext(clientId, created.id),
      ),
      200,
    );
    assert.equal(providerPatched.provider_name, "Future Fund");
    assert.equal(providerPatched.member_number, "MEM-456");

    const providerAudit = await expectAuditEvent(
      db,
      providerPatchRequestId,
      "super_pension_account",
    );
    const providerAlert = await db.alert_instance.findFirst({
      where: {
        audit_event_id: providerAudit.id,
        entity_type: "super_pension_account",
        entity_id: created.id,
      },
      orderBy: {
        occurred_at: "asc",
      },
    });
    assert.ok(providerAlert, "expected super_pension_account alert_instance");
    assert.equal(providerAlert.payload.field, "provider_name");
    assert.equal(providerAlert.payload.old, "Aware Super");
    assert.equal(providerAlert.payload.new, "Future Fund");
    console.log("ok - super_pension_account provider change writes audit_event and alert_instance");

    const emptyNominationRequestId = `r2hc-empty-nomination-${Date.now()}`;
    await expectJson(
      await accountRow.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts/${created.id}`,
          "PATCH",
          { beneficiaryNominationType: "" },
          emptyNominationRequestId,
        ),
        rowContext(clientId, created.id),
      ),
      200,
    );
    const accountRowAfterEmpty = await db.super_pension_account.findUnique({
      where: { id: created.id },
      select: { beneficiary_nomination_type: true },
    });
    assert.equal(accountRowAfterEmpty.beneficiary_nomination_type, null);
    console.log("ok - super_pension_account empty beneficiary_nomination_type stores NULL");

    await expectJson(
      await accountRow.DELETE(
        emptyRequest(
          `http://localhost/api/clients/${clientId}/super-pension-accounts/${created.id}`,
          "DELETE",
          `r2hc-account-delete-${Date.now()}`,
        ),
        rowContext(clientId, created.id),
      ),
      200,
    );
    const deleted = await db.super_pension_account.findUnique({
      where: { id: created.id },
      select: { id: true },
    });
    assert.equal(deleted, null);
    console.log("ok - super_pension_account DELETE removes row");
  } finally {
    try {
      if (clientId) {
        await hardDeleteParty(clientId, ACTOR_ID);
      }
    } catch (error) {
      console.error("[integration] Cleanup failed:", error);
    }

    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
