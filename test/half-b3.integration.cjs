require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
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
const PRACTICE_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = `${Date.now()}`;
const CALENDLY_SIGNING_KEY = `half-b3-calendly-secret-${RUN_ID}`;
const CRON_SECRET = `half-b3-cron-secret-${RUN_ID}`;
const CALENDLY_EVENT_TYPE_URI = `https://api.calendly.com/event_types/half-b3-${RUN_ID}`;

process.env.CALENDLY_WEBHOOK_SIGNING_KEY = CALENDLY_SIGNING_KEY;
process.env.CRON_SHARED_SECRET = CRON_SECRET;

function signedCalendlyRequest(url, body, requestId) {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", CALENDLY_SIGNING_KEY)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  return new Request(url, {
    method: "POST",
    headers: {
      "Calendly-Webhook-Signature": `t=${timestamp},v1=${digest}`,
      "content-type": "application/json",
      "user-agent": "ConcilioHalfB3Integration/1.0",
      "x-forwarded-for": "127.0.0.1",
      "x-request-id": requestId,
    },
    body: rawBody,
  });
}

function cronRequest(url, method, requestId) {
  return new Request(url, {
    method,
    headers: {
      "x-cron-secret": CRON_SECRET,
      "x-request-id": requestId,
      "user-agent": "ConcilioHalfB3Integration/1.0",
      "x-forwarded-for": "127.0.0.1",
    },
  });
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

async function ensureUser(db) {
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
      name: "Round 1 B3 Smoke Actor",
      status: "active",
      role: "adviser",
      practice_id: PRACTICE_ID,
    },
    create: {
      id: ACTOR_ID,
      practice_id: PRACTICE_ID,
      name: "Round 1 B3 Smoke Actor",
      email: ACTOR_EMAIL,
      role: "adviser",
      status: "active",
    },
  });
}

async function createPartyFixture(db) {
  const party = await db.party.create({
    data: {
      party_type: "person",
      display_name: `Round B3 Nudge ${RUN_ID}`,
      status: "active",
    },
  });

  await db.person.create({
    data: {
      id: party.id,
      legal_given_name: "Round",
      legal_family_name: `B3 Nudge ${RUN_ID}`,
      date_of_birth: new Date("1982-03-04T00:00:00.000Z"),
      email_primary: `round.b3.nudge.${RUN_ID}@example.test`,
      mobile_phone: "0400000003",
      country_of_residence: "AU",
      citizenships: [],
    },
  });

  return party.id;
}

async function ensureEngagementTemplate(db) {
  const existing = await db.workflow_template.findUnique({
    where: { key: "engagement" },
    select: { id: true, version: true },
  });

  if (existing) {
    return { ...existing, created: false };
  }

  const created = await db.workflow_template.create({
    data: {
      key: "engagement",
      name: `Half B3 Engagement ${RUN_ID}`,
      phase_order: null,
      version: 1,
      description: "Temporary local fixture for Half B3 nudge cron smoke test.",
      stages: [],
      status: "deployed",
      created_by: ACTOR_ID,
    },
    select: { id: true, version: true },
  });

  return { ...created, created: true };
}

async function createNudgeFixture(db) {
  const partyId = await createPartyFixture(db);
  const workflowTemplate = await ensureEngagementTemplate(db);
  const smsTemplateId = `half_b3_sms_${RUN_ID}`;
  const driverActionKey = `half_b3_send_engagement_doc_${RUN_ID}`;

  await db.emailTemplate.create({
    data: {
      id: smsTemplateId,
      name: `Half B3 SMS ${RUN_ID}`,
      subject: "Half B3 nudge",
      body: "Hi {{clientFirstName}}, this is a local Half B3 nudge smoke test.",
      category: "workflow",
      channel: "sms",
      isActive: true,
    },
  });

  const nudgeTemplate = await db.workflow_template_nudge.create({
    data: {
      workflow_template_key: "engagement",
      decision_state_key: "driving_engagement_doc",
      driver_action_key: driverActionKey,
      nudge_sequence_index: 1,
      delay_days: 0,
      sms_template_key: smsTemplateId,
      preferred_channel: "sms",
      terminal: false,
    },
  });

  const engagement = await db.engagement.create({
    data: {
      party_id: partyId,
      engagement_type: "other",
      status: "open",
      source: "MANUAL",
      primary_adviser_id: ACTOR_ID,
      opened_at: new Date(),
      notes: "Half B3 local nudge cron fixture.",
    },
  });

  const workflowInstance = await db.workflow_instance.create({
    data: {
      workflow_template_id: workflowTemplate.id,
      template_id: workflowTemplate.id,
      template_version: workflowTemplate.version,
      engagement_id: engagement.id,
      party_id: partyId,
      current_stage: "active",
      status: "active",
      trigger_date: new Date(),
      started_at: new Date(),
      last_driver_action_key: driverActionKey,
      last_driver_action_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      last_event_at: new Date(),
      context_data: {},
    },
  });

  return {
    partyId,
    engagementId: engagement.id,
    workflowInstanceId: workflowInstance.id,
    workflowTemplateId: workflowTemplate.id,
    workflowTemplateCreated: workflowTemplate.created,
    nudgeTemplateId: nudgeTemplate.id,
    smsTemplateId,
  };
}

function calendlyInviteeCreatedPayload(eventUuid, inviteeUuid) {
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  return {
    event: "invitee.created",
    created_at: new Date().toISOString(),
    payload: {
      uri: `https://api.calendly.com/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`,
      email: `round.b3.calendly.${RUN_ID}@example.test`,
      name: `Round B3 Calendly ${RUN_ID}`,
      cancel_url: "https://calendly.com/cancellations/test",
      reschedule_url: "https://calendly.com/reschedulings/test",
      text_reminder_number: "+61400000004",
      scheduled_event: {
        uri: `https://api.calendly.com/scheduled_events/${eventUuid}`,
        event_type: CALENDLY_EVENT_TYPE_URI,
        start_time: startsAt.toISOString(),
        end_time: endsAt.toISOString(),
        location: {
          type: "zoom",
          join_url: "https://example.test/meeting",
        },
        event_memberships: [
          {
            user_email: ACTOR_EMAIL,
          },
        ],
      },
      questions_and_answers: [],
    },
  };
}

async function cleanup(db, ids) {
  if (ids.calendlyEventTypeMapId) {
    await db.calendly_event_type_map.deleteMany({
      where: { id: ids.calendlyEventTypeMapId },
    });
  }

  if (ids.workflowInstanceId) {
    await db.workflow_instance_nudge.deleteMany({
      where: { workflow_instance_id: ids.workflowInstanceId },
    });
    await db.workflow_event.deleteMany({
      where: { instance_id: ids.workflowInstanceId },
    });
    await db.workflow_instance.deleteMany({
      where: { id: ids.workflowInstanceId },
    });
  }

  if (ids.nudgeTemplateId) {
    await db.workflow_template_nudge.deleteMany({
      where: { id: ids.nudgeTemplateId },
    });
  }

  if (ids.smsTemplateId) {
    await db.emailTemplate.deleteMany({ where: { id: ids.smsTemplateId } });
  }

  if (ids.nudgeEngagementId) {
    await db.file_note.deleteMany({ where: { engagement_id: ids.nudgeEngagementId } });
    await db.engagement.deleteMany({ where: { id: ids.nudgeEngagementId } });
  }

  if (ids.calendlyEventUuid) {
    const calendlyEngagement = await db.engagement.findUnique({
      where: { calendly_event_uuid: ids.calendlyEventUuid },
      select: { id: true },
    });

    if (calendlyEngagement) {
      await db.file_note.deleteMany({ where: { engagement_id: calendlyEngagement.id } });
      await db.workflow_instance.deleteMany({ where: { engagement_id: calendlyEngagement.id } });
      await db.engagement.deleteMany({ where: { id: calendlyEngagement.id } });
    }
  }

  if (ids.partyId) {
    await db.client_classification.deleteMany({ where: { party_id: ids.partyId } });
    await db.person.deleteMany({ where: { id: ids.partyId } });
    await db.party.deleteMany({ where: { id: ids.partyId } });
  }

  if (ids.workflowTemplateCreated && ids.workflowTemplateId) {
    await db.workflow_template.deleteMany({ where: { id: ids.workflowTemplateId } });
  }
}

async function main() {
  const { db } = require("../src/lib/db.ts");
  const calendlyRoute = require("../src/app/api/webhooks/calendly/route.ts");
  const nudgeCronRoute = require("../src/app/api/cron/nudges/run/route.ts");

  const requestIds = {
    calendly: `half-b3-calendly-${RUN_ID}`,
    nudgeCron: `half-b3-nudge-cron-${RUN_ID}`,
  };
  const ids = {
    partyId: null,
    nudgeEngagementId: null,
    workflowInstanceId: null,
    workflowTemplateId: null,
    workflowTemplateCreated: false,
    nudgeTemplateId: null,
    smsTemplateId: null,
    calendlyEventUuid: `half-b3-cal-event-${RUN_ID}`,
    calendlyEventTypeMapId: `half_b3_event_type_${RUN_ID}`,
  };

  try {
    await ensureUser(db);
    await db.calendly_event_type_map.create({
      data: {
        id: ids.calendlyEventTypeMapId,
        meeting_type_key: "HALF_B3_TEST",
        display_name: "Half B3 Test Meeting",
        calendly_event_type_uri: CALENDLY_EVENT_TYPE_URI,
        auto_create_prospect: false,
        unresolved_log_level: "info",
        active: true,
      },
    });

    const calendlyResponse = await calendlyRoute.POST(
      signedCalendlyRequest(
        "http://localhost/api/webhooks/calendly",
        calendlyInviteeCreatedPayload(ids.calendlyEventUuid, `half-b3-invitee-${RUN_ID}`),
        requestIds.calendly,
      ),
    );
    const calendlyBody = await expectJson(calendlyResponse, 200);
    assert.equal(calendlyBody.ok, true);

    const nudgeFixture = await createNudgeFixture(db);
    ids.partyId = nudgeFixture.partyId;
    ids.nudgeEngagementId = nudgeFixture.engagementId;
    ids.workflowInstanceId = nudgeFixture.workflowInstanceId;
    ids.workflowTemplateId = nudgeFixture.workflowTemplateId;
    ids.workflowTemplateCreated = nudgeFixture.workflowTemplateCreated;
    ids.nudgeTemplateId = nudgeFixture.nudgeTemplateId;
    ids.smsTemplateId = nudgeFixture.smsTemplateId;

    const cronResponse = await nudgeCronRoute.POST(
      cronRequest("http://localhost/api/cron/nudges/run", "POST", requestIds.nudgeCron),
    );
    const cronBody = await expectJson(cronResponse, 200);
    assert.equal(cronBody.dry_run, false);
    assert.equal(cronBody.nudges_fired >= 1, true);

    const calendlyAudit = await db.audit_event.findFirst({
      where: { request_id: requestIds.calendly },
      select: {
        event_type: true,
        actor_id: true,
        actor_ip: true,
        actor_user_agent: true,
        actor_type: true,
        subject_type: true,
        subject_id: true,
        details: true,
      },
    });

    assert.ok(calendlyAudit, "Calendly webhook audit_event was not written");
    assert.equal(calendlyAudit.event_type, "CREATE");
    assert.equal(calendlyAudit.actor_type, "system");
    assert.equal(calendlyAudit.actor_id, null);
    assert.equal(calendlyAudit.actor_ip, null);
    assert.equal(calendlyAudit.actor_user_agent, null);
    assert.equal(calendlyAudit.subject_type, "engagement");
    assert.equal(calendlyAudit.details.metadata.source, "calendly");
    assert.equal(calendlyAudit.details.metadata.event_type, "invitee.created");
    assert.equal(calendlyAudit.details.metadata.signature_verified, true);

    const nudgeAudits = await db.audit_event.findMany({
      where: {
        request_id: requestIds.nudgeCron,
        event_type: "NUDGE_FIRED",
      },
      select: {
        event_type: true,
        actor_id: true,
        actor_ip: true,
        actor_user_agent: true,
        actor_type: true,
        subject_type: true,
        details: true,
      },
    });

    const nudgeAudit = nudgeAudits.find(
      (event) => event.details.metadata.workflow_instance_id === ids.workflowInstanceId,
    );

    assert.ok(nudgeAudit, "Nudge cron audit_event was not written for the fixture instance");
    assert.equal(nudgeAudit.actor_type, "system");
    assert.equal(nudgeAudit.actor_id, null);
    assert.equal(nudgeAudit.actor_ip, null);
    assert.equal(nudgeAudit.actor_user_agent, null);
    assert.equal(nudgeAudit.subject_type, "workflow_instance_nudge");
    assert.equal(nudgeAudit.details.metadata.source, "cron");
    assert.equal(nudgeAudit.details.metadata.cron_job, "workflow_nudges");
    assert.equal(nudgeAudit.details.metadata.method, "POST");
    assert.equal(nudgeAudit.details.metadata.result, "stubbed");

    console.log("[integration] Half B3 audit events:");
    console.log(
      `  ${calendlyAudit.event_type} ${calendlyAudit.subject_type}/${calendlyAudit.subject_id} request_id=${requestIds.calendly}`,
    );
    console.log(
      `  ${nudgeAudit.event_type} ${nudgeAudit.subject_type} workflow_instance_id=${ids.workflowInstanceId} request_id=${requestIds.nudgeCron}`,
    );
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
