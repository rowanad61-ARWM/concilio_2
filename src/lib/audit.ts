/**
 * Audit trail writer for Concilio.
 * Every create, update, archive and sensitive-data access is logged here.
 * Call writeAuditEvent() from any API route after a successful operation.
 * Failures are caught and logged to console — they never crash the app.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

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
  const details: Prisma.InputJsonObject = {
    before: (input.beforeState ?? {}) as Prisma.InputJsonObject,
    after: (input.afterState ?? {}) as Prisma.InputJsonObject,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  }

  try {
    await db.audit_event.create({
      data: {
        event_type: input.action,
        actor_type: input.channel === 'staff_ui' ? 'user' :
                    input.channel === 'portal' ? 'portal' :
                    input.channel === 'api' ? 'api' : 'system',
        actor_id: input.userId,
        subject_type: input.entityType,
        subject_id: input.entityId,
        details,
      },
    })
  } catch (error) {
    console.error('[Audit] Failed to write audit event:', error)
  }
}
