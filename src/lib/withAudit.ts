/**
 * withAudit — wraps Next.js API route handlers with automatic audit logging.
 * Usage: export const POST = withAudit(handler, 'CREATE', 'client')
 * The audit write is non-blocking — it never delays the response.
 */

import { writeAuditEvent, AuditAction, AuditChannel } from '@/lib/audit'

type RouteHandler = (req: Request) => Promise<Response>

export function withAudit(
  handler: RouteHandler,
  action: AuditAction,
  entityType: string,
  channel: AuditChannel = 'staff_ui'
): RouteHandler {
  return async (req: Request): Promise<Response> => {
    const response = await handler(req)

    if (response.ok) {
      void writeAuditEvent({
        userId: 'system',
        action,
        entityType,
        entityId: 'unknown',
        channel,
        ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      })
    }

    return response
  }
}
