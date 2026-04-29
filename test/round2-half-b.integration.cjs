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
      "user-agent": "ConcilioRound2HalfBIntegration/1.0",
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
      "user-agent": "ConcilioRound2HalfBIntegration/1.0",
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

async function exerciseResource({
  db,
  clientId,
  label,
  subjectType,
  collectionRoute,
  rowRoute,
  createBody,
  patchBody,
  expectedPatch,
}) {
  const createRequestId = `r2hb-${label}-create-${Date.now()}`;
  const created = await expectJson(
    await collectionRoute.POST(
      jsonRequest(
        `http://localhost/api/clients/${clientId}/${label}`,
        "POST",
        createBody,
        createRequestId,
      ),
      contextFor(clientId),
    ),
    200,
  );
  assert.ok(created.id);
  await expectAuditEvent(db, createRequestId, subjectType);

  const listAfterCreate = await expectJson(
    await collectionRoute.GET(
      emptyRequest(
        `http://localhost/api/clients/${clientId}/${label}`,
        "GET",
        `r2hb-${label}-list-${Date.now()}`,
      ),
      contextFor(clientId),
    ),
    200,
  );
  assert.equal(listAfterCreate.items.length, 1);

  const patchRequestId = `r2hb-${label}-patch-${Date.now()}`;
  const updated = await expectJson(
    await rowRoute.PATCH(
      jsonRequest(
        `http://localhost/api/clients/${clientId}/${label}/${created.id}`,
        "PATCH",
        patchBody,
        patchRequestId,
      ),
      rowContext(clientId, created.id),
    ),
    200,
  );
  for (const [key, value] of Object.entries(expectedPatch)) {
    assert.equal(updated[key], value);
  }
  await expectAuditEvent(db, patchRequestId, subjectType);

  const deleteRequestId = `r2hb-${label}-delete-${Date.now()}`;
  await expectJson(
    await rowRoute.DELETE(
      emptyRequest(
        `http://localhost/api/clients/${clientId}/${label}/${created.id}`,
        "DELETE",
        deleteRequestId,
      ),
      rowContext(clientId, created.id),
    ),
    200,
  );
  await expectAuditEvent(db, deleteRequestId, subjectType);

  const listAfterDelete = await expectJson(
    await collectionRoute.GET(
      emptyRequest(
        `http://localhost/api/clients/${clientId}/${label}`,
        "GET",
        `r2hb-${label}-list-after-delete-${Date.now()}`,
      ),
      contextFor(clientId),
    ),
    200,
  );
  assert.equal(listAfterDelete.items.length, 0);
}

async function main() {
  const { db } = require("../src/lib/db.ts");
  const { hardDeleteParty } = require("../src/lib/partyDelete.ts");
  const clientsRoute = require("../src/app/api/clients/route.ts");
  const clientRoute = require("../src/app/api/clients/[id]/route.ts");
  const professionalCollection = require("../src/app/api/clients/[id]/professional-relationships/route.ts");
  const professionalRow = require("../src/app/api/clients/[id]/professional-relationships/[rowId]/route.ts");
  const beneficiaryCollection = require("../src/app/api/clients/[id]/estate-beneficiaries/route.ts");
  const beneficiaryRow = require("../src/app/api/clients/[id]/estate-beneficiaries/[rowId]/route.ts");
  const executorCollection = require("../src/app/api/clients/[id]/estate-executors/route.ts");
  const executorRow = require("../src/app/api/clients/[id]/estate-executors/[rowId]/route.ts");
  const poaCollection = require("../src/app/api/clients/[id]/powers-of-attorney/route.ts");
  const poaRow = require("../src/app/api/clients/[id]/powers-of-attorney/[rowId]/route.ts");

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
    const createClientRequestId = `r2hb-create-client-${Date.now()}`;
    const createdClient = await expectJson(
      await clientsRoute.POST(
        jsonRequest(
          "http://localhost/api/clients",
          "POST",
          {
            firstName: "Halfb",
            lastName: "Client",
            dateOfBirth: "1979-03-03",
            email: `round2b.${Date.now()}@example.test`,
            relationshipStatus: "single",
            countryOfResidence: "AU",
          },
          createClientRequestId,
        ),
      ),
      200,
    );
    clientId = createdClient.id;

    const patchClientRequestId = `r2hb-patch-client-${Date.now()}`;
    await expectJson(
      await clientRoute.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}`,
          "PATCH",
          {
            willExists: true,
            willIsCurrent: false,
            willDate: "2024-01-15",
            willLocation: "Safe custody",
            estatePlanningNotes: "Integration estate note",
            funeralPlanStatus: "unknown",
          },
          patchClientRequestId,
        ),
        contextFor(clientId),
      ),
      200,
    );

    const estatePerson = await db.person.findUnique({
      where: { id: clientId },
      select: {
        will_exists: true,
        will_is_current: true,
        will_date: true,
        will_location: true,
        estate_planning_notes: true,
        funeral_plan_status: true,
      },
    });
    assert.equal(estatePerson.will_exists, true);
    assert.equal(estatePerson.will_is_current, false);
    assert.equal(estatePerson.will_date.toISOString().slice(0, 10), "2024-01-15");
    assert.equal(estatePerson.will_location, "Safe custody");
    assert.equal(estatePerson.estate_planning_notes, "Integration estate note");
    assert.equal(estatePerson.funeral_plan_status, "unknown");
    await expectAuditEvent(db, patchClientRequestId, "person");
    console.log("ok - PATCH client updates estate fields and writes audit_event");

    await exerciseResource({
      db,
      clientId,
      label: "professional-relationships",
      subjectType: "professional_relationship",
      collectionRoute: professionalCollection,
      rowRoute: professionalRow,
      createBody: {
        relationshipType: "solicitor",
        firstName: "Pat",
        surname: "Law",
        company: "Law Co",
      },
      patchBody: { phone: "0299990000", isAuthorised: true },
      expectedPatch: { phone: "0299990000", is_authorised: true },
    });
    console.log("ok - professional_relationship POST/PATCH/GET/DELETE");

    await exerciseResource({
      db,
      clientId,
      label: "estate-beneficiaries",
      subjectType: "estate_beneficiary",
      collectionRoute: beneficiaryCollection,
      rowRoute: beneficiaryRow,
      createBody: {
        entityType: "person",
        firstName: "Ben",
        surname: "Beneficiary",
      },
      patchBody: { ageOfEntitlement: 25, preferredName: "Benny" },
      expectedPatch: { age_of_entitlement: 25, preferred_name: "Benny" },
    });
    console.log("ok - estate_beneficiary POST/PATCH/GET/DELETE");

    await exerciseResource({
      db,
      clientId,
      label: "estate-executors",
      subjectType: "estate_executor",
      collectionRoute: executorCollection,
      rowRoute: executorRow,
      createBody: {
        entityType: "person",
        firstName: "Ella",
        surname: "Executor",
      },
      patchBody: { surname: "Executor-Smith" },
      expectedPatch: { surname: "Executor-Smith" },
    });
    console.log("ok - estate_executor POST/PATCH/GET/DELETE");

    const missingProfessionalType = await professionalCollection.POST(
      jsonRequest(
        `http://localhost/api/clients/${clientId}/professional-relationships`,
        "POST",
        { firstName: "No", surname: "Type" },
        `r2hb-professional-validation-${Date.now()}`,
      ),
      contextFor(clientId),
    );
    await expectJson(missingProfessionalType, 400);
    console.log("ok - professional_relationship rejects missing relationship_type");

    const invalidPoaType = await poaCollection.POST(
      jsonRequest(
        `http://localhost/api/clients/${clientId}/powers-of-attorney`,
        "POST",
        {
          poaType: "forever",
          entityType: "person",
          firstName: "Invalid",
          surname: "POA",
        },
        `r2hb-poa-validation-${Date.now()}`,
      ),
      contextFor(clientId),
    );
    await expectJson(invalidPoaType, 400);
    console.log("ok - power_of_attorney rejects invalid poa_type");

    const poaCreateRequestId = `r2hb-poa-create-${Date.now()}`;
    const poa = await expectJson(
      await poaCollection.POST(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/powers-of-attorney`,
          "POST",
          {
            poaType: "enduring",
            entityType: "person",
            firstName: "Peter",
            surname: "Attorney",
            location: "Binder",
          },
          poaCreateRequestId,
        ),
        contextFor(clientId),
      ),
      200,
    );
    await expectAuditEvent(db, poaCreateRequestId, "power_of_attorney");

    const poaPatchRequestId = `r2hb-poa-patch-${Date.now()}`;
    await expectJson(
      await poaRow.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/powers-of-attorney/${poa.id}`,
          "PATCH",
          { surname: "Attorney-Smith" },
          poaPatchRequestId,
        ),
        rowContext(clientId, poa.id),
      ),
      200,
    );
    const poaAuditEvent = await expectAuditEvent(db, poaPatchRequestId, "power_of_attorney");
    const poaAlert = await db.alert_instance.findFirst({
      where: {
        audit_event_id: poaAuditEvent.id,
        entity_type: "power_of_attorney",
        entity_id: poa.id,
      },
    });
    assert.ok(poaAlert, "expected power_of_attorney surname alert_instance");
    assert.equal(poaAlert.payload.field, "surname");
    assert.equal(poaAlert.payload.old, "Attorney");
    assert.equal(poaAlert.payload.new, "Attorney-Smith");

    await expectJson(
      await poaRow.DELETE(
        emptyRequest(
          `http://localhost/api/clients/${clientId}/powers-of-attorney/${poa.id}`,
          "DELETE",
          `r2hb-poa-delete-${Date.now()}`,
        ),
        rowContext(clientId, poa.id),
      ),
      200,
    );
    console.log("ok - power_of_attorney POST/PATCH/GET/DELETE and surname alert");
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
