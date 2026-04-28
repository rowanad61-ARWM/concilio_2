require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const assert = require("node:assert/strict");

const {
  resetAuditMiddlewareTestHooks,
  setAuditMiddlewareTestHooks,
  withAuditTrail,
} = require("../src/lib/audit-middleware.ts");

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const ENTITY_ID = "22222222-2222-4222-8222-222222222222";
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function auditRequest(headers = {}) {
  return new Request(`https://concilio.test/api/clients/${ENTITY_ID}`, {
    method: "PATCH",
    headers,
  });
}

test("happy path writes audit_event with snapshots and actor context", async () => {
  const writes = [];
  const beforeSnapshot = { id: ENTITY_ID, status: "draft" };
  const afterSnapshot = { id: ENTITY_ID, status: "active" };

  setAuditMiddlewareTestHooks({
    auth: async () => ({ user: { id: ACTOR_ID, email: "audit@example.com" } }),
    resolveActorUserId: async () => ACTOR_ID,
    writeAuditEvent: async (input) => {
      writes.push(input);
    },
    requestId: () => "generated-request-id",
  });

  const wrapped = withAuditTrail(
    async () => jsonResponse({ ok: true }),
    {
      entity_type: "client",
      action: "UPDATE",
      beforeFn: async () => beforeSnapshot,
      afterFn: async () => afterSnapshot,
    },
  );

  const response = await wrapped(
    auditRequest({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "user-agent": "AuditTest/1.0",
      "x-request-id": "request-123",
    }),
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].userId, ACTOR_ID);
  assert.equal(writes[0].action, "UPDATE");
  assert.equal(writes[0].entityType, "client");
  assert.equal(writes[0].entityId, ENTITY_ID);
  assert.equal(writes[0].actor_ip, "203.0.113.10");
  assert.equal(writes[0].actor_user_agent, "AuditTest/1.0");
  assert.equal(writes[0].request_id, "request-123");
  assert.deepEqual(writes[0].before_snapshot, beforeSnapshot);
  assert.deepEqual(writes[0].after_snapshot, afterSnapshot);
});

test("handler throws without writing audit_event", async () => {
  const writes = [];

  setAuditMiddlewareTestHooks({
    auth: async () => ({ user: { id: ACTOR_ID } }),
    resolveActorUserId: async () => ACTOR_ID,
    writeAuditEvent: async (input) => {
      writes.push(input);
    },
  });

  const wrapped = withAuditTrail(
    async () => {
      throw new Error("mutation failed");
    },
    {
      entity_type: "client",
      action: "UPDATE",
      beforeFn: async () => ({ id: ENTITY_ID }),
      afterFn: async () => ({ id: ENTITY_ID }),
    },
  );

  await assert.rejects(() => wrapped(auditRequest(), {}), /mutation failed/);
  assert.equal(writes.length, 0);
});

test("audit write failure is logged and does not block handler response", async () => {
  const logEntries = [];

  setAuditMiddlewareTestHooks({
    auth: async () => ({ user: { id: ACTOR_ID } }),
    resolveActorUserId: async () => ACTOR_ID,
    writeAuditEvent: async () => {
      throw new Error("audit database unavailable");
    },
    logError: (...args) => {
      logEntries.push(args);
    },
  });

  const wrapped = withAuditTrail(
    async () => jsonResponse({ saved: true }, { status: 201 }),
    {
      entity_type: "client",
      action: "UPDATE",
      beforeFn: async () => ({ id: ENTITY_ID, name: "Same" }),
      afterFn: async () => ({ id: ENTITY_ID, name: "Same" }),
    },
  );

  const response = await wrapped(auditRequest(), {});

  assert.equal(response.status, 201);
  assert.equal(logEntries.length, 1);
  assert.match(String(logEntries[0][0]), /Failed to write audit_event/);
  assert.match(String(logEntries[0][1]), /audit database unavailable/);
});

test("no diff between snapshots still writes audit_event", async () => {
  const writes = [];
  const unchangedSnapshot = { id: ENTITY_ID, reviewMonth: 4 };

  setAuditMiddlewareTestHooks({
    auth: async () => ({ user: { id: ACTOR_ID } }),
    resolveActorUserId: async () => ACTOR_ID,
    writeAuditEvent: async (input) => {
      writes.push(input);
    },
  });

  const wrapped = withAuditTrail(
    async () => jsonResponse({ ok: true }),
    {
      entity_type: "client",
      action: "UPDATE",
      beforeFn: async () => unchangedSnapshot,
      afterFn: async () => unchangedSnapshot,
    },
  );

  const response = await wrapped(auditRequest(), {});

  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].before_snapshot, unchangedSnapshot);
  assert.deepEqual(writes[0].after_snapshot, unchangedSnapshot);
});

async function run() {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${name}`);
      console.error(error);
    } finally {
      resetAuditMiddlewareTestHooks();
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void run();
