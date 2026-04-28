import { db } from "@/lib/db"
import type { AuditSnapshot } from "@/lib/audit"
import type { AuditLifecycleContext } from "@/lib/audit-middleware"

export type DocumentFolderRouteContext = {
  params: Promise<{ clientId: string; folder: string }>
}

export type DocumentFileRouteContext = {
  params: Promise<{ clientId: string; folder: string; fileId: string }>
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

export function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function documentFolderRouteParams(
  context: DocumentFolderRouteContext,
): Promise<{ clientId: string; folder: string }> {
  const { clientId, folder } = await context.params
  return {
    clientId: decodeRouteSegment(clientId).trim(),
    folder: decodeRouteSegment(folder).trim(),
  }
}

export async function documentFileRouteParams(
  context: DocumentFileRouteContext,
): Promise<{ clientId: string; folder: string; fileId: string }> {
  const { clientId, folder, fileId } = await context.params
  return {
    clientId: decodeRouteSegment(clientId).trim(),
    folder: decodeRouteSegment(folder).trim(),
    fileId: decodeRouteSegment(fileId).trim(),
  }
}

export function readCreatedFolders(response: Response | undefined): string[] {
  if (!response) {
    return []
  }

  const raw = response.headers.get("x-concilio-created-folders")
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : []
  } catch {
    return []
  }
}

export async function responseFileId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ id?: unknown }>(auditContext)
  return typeof payload?.id === "string" ? payload.id : null
}

export async function loadFileNoteSnapshot(id: string): Promise<AuditSnapshot> {
  return db.file_note.findUnique({
    where: { id },
  })
}

export async function responseFileNoteId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ id?: unknown }>(auditContext)
  return typeof payload?.id === "string" ? payload.id : null
}
