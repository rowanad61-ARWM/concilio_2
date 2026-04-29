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
      "user-agent": "ConcilioRound2HalfAIntegration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

function contextForId(id) {
  return { params: Promise.resolve({ id }) };
}

function memberContext(householdId, memberId) {
  return { params: Promise.resolve({ id: householdId, memberId }) };
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
  const clientRoute = require("../src/app/api/clients/[id]/route.ts");
  const centrelinkRoute = require("../src/app/api/clients/[id]/centrelink/route.ts");
  const householdsRoute = require("../src/app/api/households/route.ts");
  const householdRoute = require("../src/app/api/households/[id]/route.ts");
  const householdMembersRoute = require("../src/app/api/households/[id]/members/route.ts");
  const householdMemberRoute = require("../src/app/api/households/[id]/members/[memberId]/route.ts");

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
  let householdId = null;
  let dependantMemberId = null;
  let dependantPartyId = null;

  try {
    const createClientRequestId = `r2ha-create-client-${Date.now()}`;
    const createClientResponse = await clientsRoute.POST(
      jsonRequest(
        "http://localhost/api/clients",
        "POST",
        {
          firstName: "Roundtwo",
          lastName: "Client",
          preferredName: "R2",
          dateOfBirth: "1980-02-02",
          email: `round2.${Date.now()}@example.test`,
          mobile: "0400000000",
          relationshipStatus: "single",
          countryOfResidence: "AU",
        },
        createClientRequestId,
      ),
    );
    const createClientBody = await expectJson(createClientResponse, 200);
    clientId = createClientBody.id;

    const patchClientRequestId = `r2ha-patch-client-${Date.now()}`;
    await expectJson(
      await clientRoute.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}`,
          "PATCH",
          {
            title: "Ms",
            gender: "female",
            countryOfBirth: "AU",
            placeOfBirth: "Sydney",
            residentStatus: "australian_citizen",
            countryOfTaxResidency: "AU",
            taxResidentStatus: "resident",
            isPepRisk: true,
            pepNotes: "Integration test PEP note",
          },
          patchClientRequestId,
        ),
        contextForId(clientId),
      ),
      200,
    );

    const patchedPerson = await db.person.findUnique({
      where: { id: clientId },
      select: {
        title: true,
        gender: true,
        country_of_birth: true,
        place_of_birth: true,
        resident_status: true,
        country_of_tax_residency: true,
        tax_resident_status: true,
        is_pep_risk: true,
        pep_notes: true,
      },
    });
    assert.deepEqual(patchedPerson, {
      title: "Ms",
      gender: "female",
      country_of_birth: "AU",
      place_of_birth: "Sydney",
      resident_status: "australian_citizen",
      country_of_tax_residency: "AU",
      tax_resident_status: "resident",
      is_pep_risk: true,
      pep_notes: "Integration test PEP note",
    });
    await expectAuditEvent(db, patchClientRequestId, "person");
    console.log("ok - PATCH client updates new person fields and writes audit_event");

    const createHouseholdRequestId = `r2ha-create-household-${Date.now()}`;
    const createHouseholdBody = await expectJson(
      await householdsRoute.POST(
        jsonRequest(
          "http://localhost/api/households",
          "POST",
          {
            householdName: "Round 2 Household",
            memberIds: [clientId],
            primaryMemberId: clientId,
          },
          createHouseholdRequestId,
        ),
      ),
      200,
    );
    householdId = createHouseholdBody.id;

    const patchHouseholdRequestId = `r2ha-patch-household-${Date.now()}`;
    await expectJson(
      await householdRoute.PATCH(
        jsonRequest(
          `http://localhost/api/households/${householdId}`,
          "PATCH",
          {
            salutationInformal: "Roundtwo",
            addressTitleFormal: "Ms Roundtwo Client",
            householdNotes: "Integration household note",
          },
          patchHouseholdRequestId,
        ),
        contextForId(householdId),
      ),
      200,
    );

    const household = await db.household_group.findUnique({
      where: { id: householdId },
      select: {
        salutation_informal: true,
        address_title_formal: true,
        household_notes: true,
      },
    });
    assert.deepEqual(household, {
      salutation_informal: "Roundtwo",
      address_title_formal: "Ms Roundtwo Client",
      household_notes: "Integration household note",
    });
    await expectAuditEvent(db, patchHouseholdRequestId, "household_group");
    console.log("ok - PATCH household updates salutation and notes");

    const createMemberRequestId = `r2ha-create-member-${Date.now()}`;
    const createMemberBody = await expectJson(
      await householdMembersRoute.POST(
        jsonRequest(
          `http://localhost/api/households/${householdId}/members`,
          "POST",
          {
            role_in_household: "dependant",
            legal_given_name: "Test",
            legal_family_name: "Dependant",
            date_of_birth: "2010-01-01",
            is_financial_dependant: true,
            relation: "child",
          },
          createMemberRequestId,
        ),
        contextForId(householdId),
      ),
      200,
    );
    dependantMemberId = createMemberBody.id;
    dependantPartyId = createMemberBody.partyId;

    const dependantMember = await db.household_member.findUnique({
      where: { id: dependantMemberId },
      select: {
        party_id: true,
        role_in_household: true,
        is_financial_dependant: true,
        relation: true,
      },
    });
    const dependantPerson = await db.person.findUnique({
      where: { id: dependantPartyId },
      select: {
        legal_given_name: true,
        legal_family_name: true,
        date_of_birth: true,
      },
    });
    assert.equal(dependantMember.party_id, dependantPartyId);
    assert.equal(dependantMember.role_in_household, "dependant");
    assert.equal(dependantMember.is_financial_dependant, true);
    assert.equal(dependantMember.relation, "child");
    assert.equal(dependantPerson.legal_given_name, "Test");
    assert.equal(dependantPerson.legal_family_name, "Dependant");
    await expectAuditEvent(db, createMemberRequestId, "household_member");
    console.log("ok - POST dependant creates party, person and household_member rows");

    const patchMemberRequestId = `r2ha-patch-member-${Date.now()}`;
    await expectJson(
      await householdMemberRoute.PATCH(
        jsonRequest(
          `http://localhost/api/households/${householdId}/members/${dependantMemberId}`,
          "PATCH",
          {
            dependant_until_age: 18,
            preferred_name: "TD",
          },
          patchMemberRequestId,
        ),
        memberContext(householdId, dependantMemberId),
      ),
      200,
    );

    const updatedMember = await db.household_member.findUnique({
      where: { id: dependantMemberId },
      select: { dependant_until_age: true },
    });
    const updatedDependantPerson = await db.person.findUnique({
      where: { id: dependantPartyId },
      select: { preferred_name: true },
    });
    assert.equal(updatedMember.dependant_until_age, 18);
    assert.equal(updatedDependantPerson.preferred_name, "TD");
    await expectAuditEvent(db, patchMemberRequestId, "household_member");
    console.log("ok - PATCH household_member updates member and person rows");

    const deleteMemberRequestId = `r2ha-delete-member-${Date.now()}`;
    await expectJson(
      await householdMemberRoute.DELETE(
        new Request(
          `http://localhost/api/households/${householdId}/members/${dependantMemberId}`,
          {
            method: "DELETE",
            headers: {
              "user-agent": "ConcilioRound2HalfAIntegration/1.0",
              "x-forwarded-for": "127.0.0.1",
              "x-request-id": deleteMemberRequestId,
            },
          },
        ),
        memberContext(householdId, dependantMemberId),
      ),
      200,
    );

    const softDeletedMember = await db.household_member.findUnique({
      where: { id: dependantMemberId },
      select: { end_date: true },
    });
    assert.ok(softDeletedMember.end_date);
    await expectAuditEvent(db, deleteMemberRequestId, "household_member");
    console.log("ok - DELETE household_member soft-deletes by setting end_date");

    const createCentrelinkRequestId = `r2ha-centrelink-create-${Date.now()}`;
    const createdCentrelink = await expectJson(
      await centrelinkRoute.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/centrelink`,
          "PATCH",
          {
            isEligible: true,
            benefitType: "age_pension",
            crn: "123456789A",
            hasConcessionCard: true,
            concessionCardType: "pensioner_concession_card",
          },
          createCentrelinkRequestId,
        ),
        contextForId(clientId),
      ),
      200,
    );
    assert.equal(createdCentrelink.person_id, clientId);
    assert.equal(createdCentrelink.benefit_type, "age_pension");
    await expectAuditEvent(db, createCentrelinkRequestId, "centrelink_detail");
    console.log("ok - PATCH centrelink creates detail row");

    const updateCentrelinkRequestId = `r2ha-centrelink-update-${Date.now()}`;
    await expectJson(
      await centrelinkRoute.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/centrelink`,
          "PATCH",
          {
            benefitType: "jobseeker",
            crn: "987654321B",
          },
          updateCentrelinkRequestId,
        ),
        contextForId(clientId),
      ),
      200,
    );

    let centrelink = await db.centrelink_detail.findUnique({
      where: { person_id: clientId },
      select: { benefit_type: true, crn: true },
    });
    assert.deepEqual(centrelink, {
      benefit_type: "jobseeker",
      crn: "987654321B",
    });
    await expectAuditEvent(db, updateCentrelinkRequestId, "centrelink_detail");
    console.log("ok - PATCH centrelink updates existing detail row");

    const emptyCentrelinkRequestId = `r2ha-centrelink-empty-${Date.now()}`;
    await expectJson(
      await centrelinkRoute.PATCH(
        jsonRequest(
          `http://localhost/api/clients/${clientId}/centrelink`,
          "PATCH",
          {
            benefitType: "",
          },
          emptyCentrelinkRequestId,
        ),
        contextForId(clientId),
      ),
      200,
    );

    centrelink = await db.centrelink_detail.findUnique({
      where: { person_id: clientId },
      select: { benefit_type: true },
    });
    assert.equal(centrelink.benefit_type, null);
    console.log("ok - PATCH centrelink empty benefit_type stores NULL");
  } finally {
    try {
      if (householdId) {
        await db.household_member.deleteMany({ where: { household_id: householdId } });
        await db.household_group.deleteMany({ where: { id: householdId } });
      }

      if (dependantPartyId) {
        await hardDeleteParty(dependantPartyId, ACTOR_ID);
      }

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
