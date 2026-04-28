import { db } from "@/lib/db"
import type { AuditSnapshot } from "@/lib/audit"
import type { AuditLifecycleContext } from "@/lib/audit-middleware"

export type EmailTemplateRouteContext = { params: Promise<{ id: string }> }

export async function emailTemplateRouteId(
  context: EmailTemplateRouteContext,
): Promise<string> {
  const { id } = await context.params
  return id
}

export async function responseJson<T>(
  auditContext: AuditLifecycleContext,
): Promise<T | null> {
  if (!auditContext.response) {
    return null
  }

  try {
    return (await auditContext.response.clone().json()) as T
  } catch {
    return null
  }
}

export async function responseEmailTemplateId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ template?: { id?: unknown } }>(auditContext)
  return typeof payload?.template?.id === "string" ? payload.template.id : null
}

export async function responseMessageId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ messageId?: unknown }>(auditContext)
  return typeof payload?.messageId === "string" && payload.messageId
    ? payload.messageId
    : null
}

export async function loadEmailTemplateSnapshot(
  id: string,
): Promise<AuditSnapshot> {
  return db.emailTemplate.findUnique({
    where: { id },
  })
}

export async function loadEmailLogSnapshotByMessageId(
  messageId: string | null,
): Promise<AuditSnapshot> {
  if (!messageId) {
    return null
  }

  return db.emailLog.findFirst({
    where: {
      graphMessageId: messageId,
    },
    orderBy: {
      sentAt: "desc",
    },
  })
}

export async function responseEmailLogIdByMessageId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const messageId = await responseMessageId(auditContext)
  if (!messageId) {
    return null
  }

  const log = await db.emailLog.findFirst({
    where: {
      graphMessageId: messageId,
    },
    orderBy: {
      sentAt: "desc",
    },
    select: {
      id: true,
    },
  })

  return log?.id ?? null
}
