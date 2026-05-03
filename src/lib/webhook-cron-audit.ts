import { randomUUID } from "node:crypto"

import type { AuditAction, AuditSnapshot } from "@/lib/audit"
import { writeAuditEvent } from "@/lib/audit"
import type { AuditLifecycleContext } from "@/lib/audit-middleware"
import { parseCalendlyPayload } from "@/lib/calendly"
import { db } from "@/lib/db"
import type { RunWorkflowNudgesResult } from "@/lib/nudges/run"
import { loadTaskSnapshot } from "@/lib/task-audit-snapshots"
import { loadEngagementSnapshot } from "@/lib/workflow-audit-snapshots"

type WebhookRouteContext = unknown
type NudgeRunDecision = RunWorkflowNudgesResult["decisions"][number]

type CalendlyWebhookAuditSummary = {
  source: "calendly"
  event_type: string | null
  event_uuid: string | null
  invitee_uuid: string | null
  event_type_uri: string | null
  created_at: string | null
  signature_verified: boolean
  parse_error?: string
}

type MondayWebhookAuditSummary = {
  source: "monday"
  event_type: string | null
  board_id: string | null
  pulse_id: string | null
  user_id: string | null
  column_id: string | null
  task_id: string | null
  note_count_before?: number
  note_count_after?: number
  parse_error?: string
}

const calendlyWebhookSummaries = new WeakMap<Request, CalendlyWebhookAuditSummary>()
const mondayWebhookSummaries = new WeakMap<Request, MondayWebhookAuditSummary>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asIdString(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value)
  }

  return asString(value)
}

function tailFromUri(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) {
    return null
  }

  return raw.split("/").filter(Boolean).pop() ?? null
}

function snapshotId(snapshot: AuditSnapshot | undefined | null): string | null {
  if (!isRecord(snapshot)) {
    return null
  }

  return asString(snapshot.id) ?? asString(snapshot.entity_id) ?? asString(snapshot.subject_id)
}

function calendlySummaryFromRawBody(rawBody: string): CalendlyWebhookAuditSummary {
  const payload = parseCalendlyPayload(rawBody)
  const webhookPayload = isRecord(payload.payload) ? payload.payload : {}
  const scheduledEvent = isRecord(webhookPayload["scheduled_event"])
    ? webhookPayload["scheduled_event"]
    : null

  return {
    source: "calendly",
    event_type: payload.event,
    event_uuid:
      tailFromUri(scheduledEvent?.uri) ??
      tailFromUri(webhookPayload["event"]) ??
      tailFromUri(webhookPayload["uri"]),
    invitee_uuid: tailFromUri(webhookPayload["uri"]),
    event_type_uri:
      asString(scheduledEvent?.event_type) ?? asString(webhookPayload["event_type"]),
    created_at: asString(payload.created_at),
    signature_verified: true,
  }
}

async function loadEngagementSnapshotByCalendlyEventUuid(
  eventUuid: string | null,
): Promise<AuditSnapshot> {
  if (!eventUuid) {
    return null
  }

  const engagement = await db.engagement.findUnique({
    where: { calendly_event_uuid: eventUuid },
    select: { id: true },
  })

  return engagement ? loadEngagementSnapshot(engagement.id) : null
}

export async function captureCalendlyWebhookBeforeSnapshot(
  request: Request,
): Promise<AuditSnapshot> {
  try {
    const summary = calendlySummaryFromRawBody(await request.clone().text())
    calendlyWebhookSummaries.set(request, summary)
    return loadEngagementSnapshotByCalendlyEventUuid(summary.event_uuid)
  } catch (error) {
    calendlyWebhookSummaries.set(request, {
      source: "calendly",
      event_type: null,
      event_uuid: null,
      invitee_uuid: null,
      event_type_uri: null,
      created_at: null,
      signature_verified: false,
      parse_error: error instanceof Error ? error.message : "unknown error",
    })
    return null
  }
}

export async function loadCalendlyWebhookAfterSnapshot(
  request: Request,
): Promise<AuditSnapshot> {
  const summary = calendlyWebhookSummaries.get(request)
  return loadEngagementSnapshotByCalendlyEventUuid(summary?.event_uuid ?? null)
}

export function calendlyWebhookAction(
  request: Request,
  _context: WebhookRouteContext,
  auditContext: AuditLifecycleContext,
): AuditAction {
  const summary = calendlyWebhookSummaries.get(request)
  if (
    (summary?.event_type === "invitee.created" || summary?.event_type === "invitee.rescheduled") &&
    !auditContext.beforeSnapshot
  ) {
    return "CREATE"
  }

  return "UPDATE"
}

export function calendlyWebhookEntityId(
  request: Request,
  _context: WebhookRouteContext,
  auditContext: AuditLifecycleContext,
): string | null {
  return snapshotId(auditContext.afterSnapshot) ?? snapshotId(auditContext.beforeSnapshot)
}

export function calendlyWebhookMetadata(request: Request): Record<string, unknown> {
  return {
    ...(calendlyWebhookSummaries.get(request) ?? {
      source: "calendly",
      event_type: null,
      event_uuid: null,
      signature_verified: false,
    }),
  }
}

export function shouldAuditCalendlyWebhook(
  request: Request,
  _context: WebhookRouteContext,
  auditContext: AuditLifecycleContext,
): boolean {
  const eventType = calendlyWebhookSummaries.get(request)?.event_type
  return (
    (eventType === "invitee.created" || eventType === "invitee.canceled" || eventType === "invitee.rescheduled") &&
    Boolean(auditContext.beforeSnapshot || auditContext.afterSnapshot)
  )
}

async function findTaskIdByMondayPulseId(pulseId: string | null): Promise<string | null> {
  if (!pulseId) {
    return null
  }

  const task = await db.task.findFirst({
    where: { mondayItemId: pulseId },
    select: { id: true },
  })

  return task?.id ?? null
}

function mondaySummaryFromRawBody(rawBody: string): MondayWebhookAuditSummary {
  const parsed = JSON.parse(rawBody) as unknown
  const body = isRecord(parsed) ? parsed : {}
  const event = isRecord(body.event) ? body.event : null

  return {
    source: "monday",
    event_type: asString(event?.type),
    board_id: asIdString(event?.boardId),
    pulse_id: asIdString(event?.pulseId),
    user_id: asIdString(event?.userId),
    column_id: asString(event?.columnId),
    task_id: null,
  }
}

function isAuditableMondayEvent(eventType: string | null): boolean {
  return (
    eventType === "update_column_value" ||
    eventType === "change_column_value" ||
    eventType === "delete_pulse" ||
    eventType === "create_update"
  )
}

export async function captureMondayWebhookBeforeSnapshot(
  request: Request,
): Promise<AuditSnapshot> {
  try {
    const summary = mondaySummaryFromRawBody(await request.clone().text())
    if (!isAuditableMondayEvent(summary.event_type)) {
      mondayWebhookSummaries.set(request, summary)
      return null
    }

    summary.task_id = await findTaskIdByMondayPulseId(summary.pulse_id)
    if (summary.task_id && summary.event_type === "create_update") {
      summary.note_count_before = await db.taskNote.count({
        where: { taskId: summary.task_id, source: "MONDAY" },
      })
    }

    mondayWebhookSummaries.set(request, summary)
    if (!summary.task_id || summary.event_type === "create_update") {
      return null
    }

    return loadTaskSnapshot(summary.task_id)
  } catch (error) {
    mondayWebhookSummaries.set(request, {
      source: "monday",
      event_type: null,
      board_id: null,
      pulse_id: null,
      user_id: null,
      column_id: null,
      task_id: null,
      parse_error: error instanceof Error ? error.message : "unknown error",
    })
    return null
  }
}

export async function loadMondayWebhookAfterSnapshot(
  request: Request,
): Promise<AuditSnapshot> {
  const summary = mondayWebhookSummaries.get(request)
  if (!summary?.task_id) {
    return null
  }

  if (summary.event_type === "create_update") {
    summary.note_count_after = await db.taskNote.count({
      where: { taskId: summary.task_id, source: "MONDAY" },
    })

    if (
      typeof summary.note_count_before === "number" &&
      summary.note_count_after <= summary.note_count_before
    ) {
      return null
    }

    return db.taskNote.findFirst({
      where: { taskId: summary.task_id, source: "MONDAY" },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  return loadTaskSnapshot(summary.task_id)
}

export function mondayWebhookAction(request: Request): AuditAction {
  const eventType = mondayWebhookSummaries.get(request)?.event_type
  if (eventType === "delete_pulse") {
    return "DELETE"
  }

  if (eventType === "create_update") {
    return "CREATE"
  }

  return "UPDATE"
}

export function mondayWebhookEntityType(request: Request): string {
  return mondayWebhookSummaries.get(request)?.event_type === "create_update"
    ? "TaskNote"
    : "Task"
}

export function mondayWebhookEntityId(
  request: Request,
  _context: WebhookRouteContext,
  auditContext: AuditLifecycleContext,
): string | null {
  const summary = mondayWebhookSummaries.get(request)
  if (summary?.event_type === "create_update") {
    return snapshotId(auditContext.afterSnapshot)
  }

  return summary?.task_id ?? snapshotId(auditContext.afterSnapshot) ?? snapshotId(auditContext.beforeSnapshot)
}

export function mondayWebhookMetadata(request: Request): Record<string, unknown> {
  return {
    ...(mondayWebhookSummaries.get(request) ?? {
      source: "monday",
      event_type: null,
    }),
  }
}

export function shouldAuditMondayWebhook(
  request: Request,
  _context: WebhookRouteContext,
  auditContext: AuditLifecycleContext,
): boolean {
  const summary = mondayWebhookSummaries.get(request)
  if (!summary?.task_id || !isAuditableMondayEvent(summary.event_type)) {
    return false
  }

  if (summary.event_type === "create_update") {
    return Boolean(auditContext.afterSnapshot)
  }

  return Boolean(auditContext.beforeSnapshot || auditContext.afterSnapshot)
}

export function readSystemAuditRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? randomUUID()
}

export async function writeSystemAuditEvent(params: {
  action: AuditAction
  entityType: string
  entityId?: string | null
  beforeSnapshot?: AuditSnapshot
  afterSnapshot?: AuditSnapshot
  requestId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await writeAuditEvent({
      userId: null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      channel: "system",
      actor_type: "system",
      actor_ip: null,
      actor_user_agent: null,
      before_snapshot: params.beforeSnapshot ?? null,
      after_snapshot: params.afterSnapshot ?? null,
      request_id: params.requestId,
      metadata: params.metadata,
    })
  } catch (error) {
    console.error("[system audit] Failed to write audit_event; route response will still be returned", error)
  }
}

function wasNudgeDispatched(decision: NudgeRunDecision): boolean {
  return (
    decision.result === "sent" ||
    decision.result === "stubbed" ||
    decision.result === "failed"
  )
}

async function loadWorkflowInstanceNudgeSnapshot(
  workflowInstanceId: string,
  sequenceIndex: number | undefined,
): Promise<AuditSnapshot> {
  const rows = await db.workflow_instance_nudge.findMany({
    where: { workflow_instance_id: workflowInstanceId },
    orderBy: { created_at: "desc" },
    include: {
      workflow_template_nudge: true,
    },
  })

  if (typeof sequenceIndex !== "number") {
    return rows[0] ?? null
  }

  return (
    rows.find(
      (row) => row.workflow_template_nudge.nudge_sequence_index === sequenceIndex,
    ) ??
    rows[0] ??
    null
  )
}

export async function writeNudgeDispatchAuditEvents(params: {
  result: RunWorkflowNudgesResult
  requestId: string
  method: "GET" | "POST"
}): Promise<void> {
  if (params.result.dry_run) {
    return
  }

  for (const decision of params.result.decisions) {
    if (!wasNudgeDispatched(decision)) {
      continue
    }

    try {
      const afterSnapshot = await loadWorkflowInstanceNudgeSnapshot(
        decision.workflowInstanceId,
        decision.sequenceIndex,
      )

      await writeSystemAuditEvent({
        action: "NUDGE_FIRED",
        entityType: "workflow_instance_nudge",
        entityId: snapshotId(afterSnapshot),
        afterSnapshot,
        requestId: params.requestId,
        metadata: {
          source: "cron",
          cron_job: "workflow_nudges",
          method: params.method,
          workflow_instance_id: decision.workflowInstanceId,
          engagement_id: decision.engagementId,
          sequence_index: decision.sequenceIndex ?? null,
          template_key: decision.templateKey ?? null,
          channel: decision.channel ?? null,
          recipient: decision.recipient ?? null,
          due_at: decision.dueAt ?? null,
          terminal: decision.terminal ?? null,
          result: decision.result,
          detail: decision.detail ?? null,
        },
      })
    } catch (error) {
      console.error("[nudges cron] audit write failed", error)
    }
  }
}

export async function responseJsonSnapshot(
  _request: Request,
  _context: unknown,
  auditContext: AuditLifecycleContext,
): Promise<AuditSnapshot> {
  if (!auditContext.response) {
    return null
  }

  try {
    return (await auditContext.response.clone().json()) as AuditSnapshot
  } catch {
    return null
  }
}
