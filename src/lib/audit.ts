/**
 * Audit trail writer for Concilio.
 * Every create, update, archive and sensitive-data access is logged here.
 * Call writeAuditEvent() from any API route after a successful operation.
 * Failures are caught and logged to console — they never crash the app.
 */

import { db } from '@/lib/db'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'ARCHIVE'
  | 'VIEW_SENSITIVE'
  | 'LOGIN'
  | 'SEND_COMMS'

export type AuditChannel =
  | 'staff_ui'
  | 'portal'
  | 'api'
  | 'system'

export interface AuditEventInput {
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  channel: AuditChannel
  ipAddress?: string
  userAgent?: string
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.audit_event.create({
      data: {
        user_id: input.userId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        before_state: input.beforeState ?? {},
        after_state: input.afterState ?? {},
        channel: input.channel,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    console.error('[Audit] Failed to write audit event:', error)
  }
}
