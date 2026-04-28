import { db } from "@/lib/db"
import type { AuditSnapshot } from "@/lib/audit"
import type { AuditLifecycleContext } from "@/lib/audit-middleware"

export type TaskRouteContext = { params: Promise<{ id: string }> }
export type TaskDocumentRouteContext = {
  params: Promise<{ id: string; linkId: string }>
}

export async function taskRouteId(context: TaskRouteContext): Promise<string> {
  const { id } = await context.params
  return id
}

export async function taskDocumentRouteIds(
  context: TaskDocumentRouteContext,
): Promise<{ taskId: string; linkId: string }> {
  const { id, linkId } = await context.params
  return { taskId: id, linkId }
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

export async function responseTaskId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ task?: { id?: unknown } }>(auditContext)
  return typeof payload?.task?.id === "string" ? payload.task.id : null
}

export async function responseDocumentLinkId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ document?: { id?: unknown } }>(auditContext)
  return typeof payload?.document?.id === "string" ? payload.document.id : null
}

export async function responseNoteId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ note?: { id?: unknown } }>(auditContext)
  return typeof payload?.note?.id === "string" ? payload.note.id : null
}

export async function loadTaskSnapshot(id: string): Promise<AuditSnapshot> {
  return db.task.findUnique({
    where: { id },
    include: {
      owners: {
        orderBy: {
          id: "asc",
        },
      },
      documentLinks: {
        orderBy: {
          createdAt: "asc",
        },
      },
      notes: {
        orderBy: {
          createdAt: "asc",
        },
      },
      workflow_spawned_task: {
        include: {
          workflow_task_template: {
            select: {
              id: true,
              title: true,
              workflow_template_id: true,
            },
          },
        },
      },
    },
  })
}

export async function loadTaskDocumentLinkSnapshot(
  id: string,
): Promise<AuditSnapshot> {
  return db.taskDocumentLink.findUnique({
    where: { id },
  })
}

export async function loadTaskNoteSnapshot(id: string): Promise<AuditSnapshot> {
  return db.taskNote.findUnique({
    where: { id },
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
