/**
 * Audit trail writer for Concilio.
 * Every create, update, delete, login, workflow action and sensitive-data access is logged here.
 * Call writeAuditEvent() from any API route after a successful operation.
 * Failures are caught and logged to console; they never crash the app.
 */

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'VIEW_SENSITIVE'
  | 'LOGIN'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'OUTCOME_SET'
  | 'WORKFLOW_ADVANCED'
  | 'WORKFLOW_STOPPED'
  | 'DRIVER_ACTION_RECORDED'
  | 'WORKFLOW_SPAWNED'
  | 'NUDGE_FIRED'
  | 'SEND_COMMS'

export type AuditChannel =
  | 'staff_ui'
  | 'portal'
  | 'api'
  | 'system'

export type AuditSnapshot = Record<string, unknown> | unknown[] | null

export interface AuditEventInput {
  userId?: string | null
  action: AuditAction
  entityType?: string
  entity_type?: string
  entityId?: string | null
  entity_id?: string | null
  beforeState?: AuditSnapshot
  afterState?: AuditSnapshot
  beforeSnapshot?: AuditSnapshot
  afterSnapshot?: AuditSnapshot
  before_snapshot?: AuditSnapshot
  after_snapshot?: AuditSnapshot
  channel?: AuditChannel
  actorType?: string
  actor_type?: string
  ipAddress?: string | null
  userAgent?: string | null
  actorIp?: string | null
  actorUserAgent?: string | null
  actor_ip?: string | null
  actor_user_agent?: string | null
  requestId?: string | null
  request_id?: string | null
  details?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function toNullableUuid(value: string | null | undefined): string | null {
  return isUuid(value) ? value : null
}

function toSubjectUuid(value: string | null | undefined): string {
  return isUuid(value) ? value : NIL_UUID
}

function actorTypeFor(input: AuditEventInput): string {
  if (input.actor_type) return input.actor_type
  if (input.actorType) return input.actorType

  switch (input.channel) {
    case 'staff_ui':
      return 'user'
    case 'portal':
      return 'portal'
    case 'api':
      return 'api'
    case 'system':
    default:
      return 'system'
  }
}

function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
    ),
  ) as Prisma.InputJsonValue
}

export async function writeAuditEvent(input: AuditEventInput): Promise<string | null> {
  const beforeSnapshot =
    input.before_snapshot ?? input.beforeSnapshot ?? input.beforeState ?? null
  const afterSnapshot =
    input.after_snapshot ?? input.afterSnapshot ?? input.afterState ?? null
  const actorIp = input.actor_ip ?? input.actorIp ?? input.ipAddress ?? null
  const actorUserAgent =
    input.actor_user_agent ?? input.actorUserAgent ?? input.userAgent ?? null
  const requestId = input.request_id ?? input.requestId ?? null
  const entityType = input.entity_type ?? input.entityType ?? 'unknown'
  const entityId = input.entity_id ?? input.entityId ?? null

  const details: Record<string, unknown> = {
    ...(input.details ?? {}),
    before: input.beforeState ?? beforeSnapshot ?? {},
    after: input.afterState ?? afterSnapshot ?? {},
    ip_address: actorIp,
    user_agent: actorUserAgent,
    request_id: requestId,
  }

  if (input.metadata) {
    details.metadata = input.metadata
  }

  try {
    const event = await db.audit_event.create({
      select: { id: true },
      data: {
        event_type: input.action,
        actor_type: actorTypeFor(input),
        actor_id: toNullableUuid(input.userId),
        subject_type: entityType,
        subject_id: toSubjectUuid(entityId),
        details: toJsonCompatible(details),
        actor_ip: actorIp,
        actor_user_agent: actorUserAgent,
        before_snapshot:
          beforeSnapshot === null ? undefined : toJsonCompatible(beforeSnapshot),
        after_snapshot:
          afterSnapshot === null ? undefined : toJsonCompatible(afterSnapshot),
        request_id: requestId,
      },
    })
    return event.id
  } catch (error) {
    console.error('[Audit] Failed to write audit event:', error)
    return null
  }
}
