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
const serverOnlyMockPath = path.join(__dirname, "mocks", "server-only.cjs");
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

  if (request === "server-only") {
    return serverOnlyMockPath;
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
const PLACEHOLDER_ADVISER_ID = "00000000-0000-0000-0000-000000000001";
const PRACTICE_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = `${Date.now()}`;

function jsonRequest(url, method, body, requestId) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "ConcilioHalfB2Integration/1.0",
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
      "user-agent": "ConcilioHalfB2Integration/1.0",
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

async function ensureUsers(db) {
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
      name: "Round 1 B2 Smoke Actor",
      status: "active",
      role: "adviser",
      practice_id: PRACTICE_ID,
    },
    create: {
      id: ACTOR_ID,
      practice_id: PRACTICE_ID,
      name: "Round 1 B2 Smoke Actor",
      email: ACTOR_EMAIL,
      role: "adviser",
      status: "active",
    },
  });

  await db.user_account.upsert({
    where: { id: PLACEHOLDER_ADVISER_ID },
    update: {
      practice_id: PRACTICE_ID,
      name: "Placeholder Primary Adviser",
      status: "active",
      role: "adviser",
    },
    create: {
      id: PLACEHOLDER_ADVISER_ID,
      practice_id: PRACTICE_ID,
      name: "Placeholder Primary Adviser",
      email: "placeholder-primary-adviser@example.test",
      role: "adviser",
      status: "active",
    },
  });
}

async function createClientFixture(db) {
  const party = await db.party.create({
    data: {
      party_type: "person",
      display_name: `Round B2 ${RUN_ID}`,
      status: "active",
    },
  });

  await db.person.create({
    data: {
      id: party.id,
      legal_given_name: "Round",
      legal_family_name: `B2 ${RUN_ID}`,
      date_of_birth: new Date("1981-02-03T00:00:00.000Z"),
      email_primary: `round.b2.${RUN_ID}@example.test`,
      mobile_phone: "0400000002",
      country_of_residence: "AU",
      citizenships: [],
    },
  });

  await db.client_classification.create({
    data: {
      party_id: party.id,
      lifecycle_stage: "prospect",
    },
  });

  const household = await db.household_group.create({
    data: {
      household_name: `Round B2 Household ${RUN_ID}`,
      servicing_status: "active",
      primary_adviser_id: ACTOR_ID,
    },
  });

  await db.household_member.create({
    data: {
      household_id: household.id,
      party_id: party.id,
      role_in_household: "primary",
    },
  });

  return {
    partyId: party.id,
    householdId: household.id,
  };
}

async function ensureClosingTemplate(db) {
  const existing = await db.workflow_template.findUnique({
    where: { key: "closing" },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await db.workflow_template.create({
    data: {
      key: "closing",
      name: "closing",
      phase_order: null,
      version: 1,
      description: "Temporary local fixture for Half B2 stop-route smoke test.",
      stages: [],
      status: "deployed",
      created_by: ACTOR_ID,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function createPatchFixture(db, engagementId, partyId, householdId) {
  const template = await db.workflow_template.create({
    data: {
      key: `half_b2_patch_${RUN_ID}`,
      name: `Half B2 Patch ${RUN_ID}`,
      phase_order: null,
      version: 1,
      description: "Temporary local fixture for Half B2 PATCH smoke test.",
      stages: [{ key: "first" }, { key: "second" }],
      status: "deployed",
      created_by: ACTOR_ID,
    },
  });

  const instance = await db.workflow_instance.create({
    data: {
      workflow_template_id: template.id,
      template_id: template.id,
      template_version: template.version,
      engagement_id: engagementId,
      household_id: householdId,
      party_id: partyId,
      current_stage: "first",
      status: "active",
      trigger_date: new Date(),
      started_at: new Date(),
      last_event_at: new Date(),
      context_data: {},
    },
  });

  return {
    templateId: template.id,
    instanceId: instance.id,
  };
}

function assertEvent(event, expected) {
  assert.equal(event.event_type, expected.eventType);
  assert.equal(event.subject_type, expected.subjectType);
  assert.equal(event.subject_id, expected.subjectId);
  assert.equal(event.actor_id, ACTOR_ID);
  assert.equal(event.actor_ip, "127.0.0.1");
  assert.equal(event.actor_user_agent, "ConcilioHalfB2Integration/1.0");
  assert.equal(Boolean(event.before_snapshot), expected.beforeSnapshot);
  assert.equal(Boolean(event.after_snapshot), expected.afterSnapshot);
}

async function cleanup(db, ids) {
  const instanceRows = ids.engagementId
    ? await db.workflow_instance.findMany({
        where: { engagement_id: ids.engagementId },
        select: { id: true },
      })
    : [];
  const instanceIds = instanceRows.map((row) => row.id);

  if (instanceIds.length > 0) {
    await db.workflow_instance_nudge.deleteMany({
      where: { workflow_instance_id: { in: instanceIds } },
    });
    await db.workflow_event.deleteMany({
      where: { instance_id: { in: instanceIds } },
    });
    await db.workflow_spawned_task.deleteMany({
      where: { workflow_instance_id: { in: instanceIds } },
    });
    await db.workflow_instance.deleteMany({
      where: { id: { in: instanceIds } },
    });
  }

  if (ids.partyId) {
    await db.task.deleteMany({ where: { clientId: ids.partyId } });
  }

  if (ids.engagementId) {
    await db.file_note.deleteMany({ where: { engagement_id: ids.engagementId } });
    await db.engagement.deleteMany({ where: { id: ids.engagementId } });
  }

  if (ids.householdId && ids.partyId) {
    await db.household_member.deleteMany({
      where: {
        household_id: ids.householdId,
        party_id: ids.partyId,
      },
    });
  }

  if (ids.partyId) {
    await db.client_classification.deleteMany({ where: { party_id: ids.partyId } });
    await db.person.deleteMany({ where: { id: ids.partyId } });
    await db.party.deleteMany({ where: { id: ids.partyId } });
  }

  if (ids.householdId) {
    await db.household_group.deleteMany({ where: { id: ids.householdId } });
  }

  if (ids.patchTemplateId) {
    await db.workflow_template.deleteMany({ where: { id: ids.patchTemplateId } });
  }

  if (ids.closingTemplateCreated && ids.closingTemplateId) {
    await db.workflow_template.deleteMany({ where: { id: ids.closingTemplateId } });
  }
}

async function main() {
  const { db } = require("../src/lib/db.ts");
  const engagementsRoute = require("../src/app/api/engagements/route.ts");
  const advanceRoute = require("../src/app/api/engagements/[id]/advance/route.ts");
  const stopRoute = require("../src/app/api/engagements/[id]/stop/route.ts");
  const driverRoute = require("../src/app/api/workflow-instances/[id]/driver-action/route.ts");
  const muteRoute = require("../src/app/api/workflow-instances/[id]/mute-nudges/route.ts");
  const outcomeRoute = require("../src/app/api/workflow-instances/[id]/outcome/route.ts");
  const resumeRoute = require("../src/app/api/workflow-instances/[id]/resume/route.ts");
  const workflowInstanceRoute = require("../src/app/api/workflow-instances/[id]/route.ts");

  const ids = {
    partyId: null,
    householdId: null,
    engagementId: null,
    closingTemplateId: null,
    closingTemplateCreated: false,
    patchTemplateId: null,
  };

  const requestIds = {
    create: `half-b2-create-${RUN_ID}`,
    advance: `half-b2-advance-${RUN_ID}`,
    outcomeSuitable: `half-b2-outcome-suitable-${RUN_ID}`,
    driver: `half-b2-driver-${RUN_ID}`,
    mute: `half-b2-mute-${RUN_ID}`,
    outcomeHold: `half-b2-outcome-hold-${RUN_ID}`,
    resume: `half-b2-resume-${RUN_ID}`,
    stop: `half-b2-stop-${RUN_ID}`,
    patch: `half-b2-patch-${RUN_ID}`,
    failed: `half-b2-failed-${RUN_ID}`,
  };

  try {
    await ensureUsers(db);
    const clientFixture = await createClientFixture(db);
    ids.partyId = clientFixture.partyId;
    ids.householdId = clientFixture.householdId;

    const closingTemplate = await ensureClosingTemplate(db);
    ids.closingTemplateId = closingTemplate.id;
    ids.closingTemplateCreated = closingTemplate.created;

    const createResponse = await engagementsRoute.POST(
      jsonRequest(
        "http://localhost/api/engagements",
        "POST",
        {
          householdId: ids.householdId,
          engagementType: "onboarding",
          title: `Round 1 B2 Smoke ${RUN_ID}`,
          description: "Half B2 local workflow audit integration",
        },
        requestIds.create,
      ),
    );
    const created = await expectJson(createResponse, 200);
    assert.equal(typeof created.id, "string");
    ids.engagementId = created.id;

    await db.engagement.update({
      where: { id: ids.engagementId },
      data: {
        party_id: ids.partyId,
        primary_adviser_id: ACTOR_ID,
      },
    });

    const failedResponse = await outcomeRoute.POST(
      jsonRequest(
        "http://localhost/api/workflow-instances/00000000-0000-4000-8000-000000000000/outcome",
        "POST",
        { outcomeKey: "missing" },
        requestIds.failed,
      ),
      contextFor("00000000-0000-4000-8000-000000000000"),
    );
    await expectJson(failedResponse, 404);

    const advanceResponse = await advanceRoute.POST(
      jsonRequest(
        `http://localhost/api/engagements/${ids.engagementId}/advance`,
        "POST",
        { targetPhaseKey: "initial_contact" },
        requestIds.advance,
      ),
      contextFor(ids.engagementId),
    );
    const advanced = await expectJson(advanceResponse, 200);
    assert.equal(typeof advanced.newInstance?.id, "string");
    const workflowInstanceId = advanced.newInstance.id;

    const outcomeSuitableResponse = await outcomeRoute.POST(
      jsonRequest(
        `http://localhost/api/workflow-instances/${workflowInstanceId}/outcome`,
        "POST",
        { outcomeKey: "suitable" },
        requestIds.outcomeSuitable,
      ),
      contextFor(workflowInstanceId),
    );
    const outcomeSuitable = await expectJson(outcomeSuitableResponse, 200);
    assert.equal(outcomeSuitable.result.effect, "continued");

    const driverResponse = await driverRoute.POST(
      jsonRequest(
        `http://localhost/api/workflow-instances/${workflowInstanceId}/driver-action`,
        "POST",
        { actionKey: "book_in_calendly" },
        requestIds.driver,
      ),
      contextFor(workflowInstanceId),
    );
    const driver = await expectJson(driverResponse, 200);
    assert.equal(driver.result.actionKey, "book_in_calendly");
    assert.equal(driver.result.emailSent, false);

    const muteResponse = await muteRoute.POST(
      jsonRequest(
        `http://localhost/api/workflow-instances/${workflowInstanceId}/mute-nudges`,
        "POST",
        { muted: true },
        requestIds.mute,
      ),
      contextFor(workflowInstanceId),
    );
    const muted = await expectJson(muteResponse, 200);
    assert.equal(muted.instance.nudgesMuted, true);

    const outcomeHoldResponse = await outcomeRoute.POST(
      jsonRequest(
        `http://localhost/api/workflow-instances/${workflowInstanceId}/outcome`,
        "POST",
        { outcomeKey: "on_hold" },
        requestIds.outcomeHold,
      ),
      contextFor(workflowInstanceId),
    );
    const outcomeHold = await expectJson(outcomeHoldResponse, 200);
    assert.equal(outcomeHold.result.workflowStatus, "paused");

    const resumeResponse = await resumeRoute.POST(
      emptyRequest(
        `http://localhost/api/workflow-instances/${workflowInstanceId}/resume`,
        "POST",
        requestIds.resume,
      ),
      contextFor(workflowInstanceId),
    );
    const resumed = await expectJson(resumeResponse, 200);
    assert.equal(resumed.instance.status, "active");

    const patchFixture = await createPatchFixture(
      db,
      ids.engagementId,
      ids.partyId,
      ids.householdId,
    );
    ids.patchTemplateId = patchFixture.templateId;

    const patchResponse = await workflowInstanceRoute.PATCH(
      emptyRequest(
        `http://localhost/api/workflow-instances/${patchFixture.instanceId}`,
        "PATCH",
        requestIds.patch,
      ),
      contextFor(patchFixture.instanceId),
    );
    const patched = await expectJson(patchResponse, 200);
    assert.equal(patched.currentStage, "second");

    const stopResponse = await stopRoute.POST(
      emptyRequest(
        `http://localhost/api/engagements/${ids.engagementId}/stop`,
        "POST",
        requestIds.stop,
      ),
      contextFor(ids.engagementId),
    );
    const stopped = await expectJson(stopResponse, 200);
    assert.equal(typeof stopped.closingInstance?.id, "string");

    const successRequestIds = [
      requestIds.create,
      requestIds.advance,
      requestIds.outcomeSuitable,
      requestIds.driver,
      requestIds.mute,
      requestIds.outcomeHold,
      requestIds.resume,
      requestIds.patch,
      requestIds.stop,
    ];

    const events = await db.audit_event.findMany({
      where: {
        request_id: {
          in: successRequestIds,
        },
      },
      orderBy: { occurred_at: "asc" },
      select: {
        event_type: true,
        subject_type: true,
        subject_id: true,
        actor_id: true,
        actor_ip: true,
        actor_user_agent: true,
        request_id: true,
        before_snapshot: true,
        after_snapshot: true,
        details: true,
      },
    });

    assert.equal(events.length, successRequestIds.length);
    const byRequestId = new Map(events.map((event) => [event.request_id, event]));

    assertEvent(byRequestId.get(requestIds.create), {
      eventType: "CREATE",
      subjectType: "engagement",
      subjectId: ids.engagementId,
      beforeSnapshot: false,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.advance), {
      eventType: "WORKFLOW_ADVANCED",
      subjectType: "engagement",
      subjectId: ids.engagementId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assert.equal(
      byRequestId.get(requestIds.advance).details.metadata.spawned_instance_id,
      workflowInstanceId,
    );
    assertEvent(byRequestId.get(requestIds.outcomeSuitable), {
      eventType: "OUTCOME_SET",
      subjectType: "workflow_instance",
      subjectId: workflowInstanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.driver), {
      eventType: "DRIVER_ACTION_RECORDED",
      subjectType: "workflow_instance",
      subjectId: workflowInstanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assert.equal(
      byRequestId.get(requestIds.driver).details.metadata.action_key,
      "book_in_calendly",
    );
    assertEvent(byRequestId.get(requestIds.mute), {
      eventType: "UPDATE",
      subjectType: "workflow_instance",
      subjectId: workflowInstanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.outcomeHold), {
      eventType: "OUTCOME_SET",
      subjectType: "workflow_instance",
      subjectId: workflowInstanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.resume), {
      eventType: "UPDATE",
      subjectType: "workflow_instance",
      subjectId: workflowInstanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.patch), {
      eventType: "UPDATE",
      subjectType: "workflow_instance",
      subjectId: patchFixture.instanceId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assertEvent(byRequestId.get(requestIds.stop), {
      eventType: "WORKFLOW_STOPPED",
      subjectType: "engagement",
      subjectId: ids.engagementId,
      beforeSnapshot: true,
      afterSnapshot: true,
    });
    assert.equal(
      byRequestId.get(requestIds.stop).details.metadata.spawned_instance_id,
      stopped.closingInstance.id,
    );

    const failedAuditCount = await db.audit_event.count({
      where: { request_id: requestIds.failed },
    });
    assert.equal(failedAuditCount, 0);

    console.log("[integration] Half B2 event chain:");
    for (const event of events) {
      console.log(
        `  ${event.event_type} ${event.subject_type}/${event.subject_id} request_id=${event.request_id}`,
      );
    }
    console.log("[integration] Failed workflow mutation produced 0 audit_event rows.");
  } finally {
    try {
      await cleanup(db, ids);
    } finally {
      await db.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
