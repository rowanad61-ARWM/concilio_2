import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import { normalizeClientDocumentFolder } from "@/lib/documents"
import { getFileById } from "@/lib/graph"
import {
  loadTaskDocumentLinkSnapshot,
  responseDocumentLinkId,
  responseJson,
  taskRouteId,
  type TaskRouteContext,
} from "@/lib/task-audit-snapshots"

function toRequiredTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const links = await db.taskDocumentLink.findMany({
      where: {
        taskId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const withMetadata = await Promise.all(
      links.map(async (link) => {
        try {
          const file = await getFileById(link.sharepointDriveItemId)

          return {
            id: link.id,
            taskId: link.taskId,
            sharepointDriveItemId: link.sharepointDriveItemId,
            fileName: link.fileName,
            folder: link.folder,
            createdAt: link.createdAt.toISOString(),
            webUrl: file?.webUrl ?? null,
            downloadUrl: file?.["@microsoft.graph.downloadUrl"] ?? null,
            lastModifiedDateTime: file?.lastModifiedDateTime ?? null,
            size: file?.size ?? null,
            existsInSharePoint: Boolean(file),
          }
        } catch (error) {
          console.error("[task documents metadata error]", error)

          return {
            id: link.id,
            taskId: link.taskId,
            sharepointDriveItemId: link.sharepointDriveItemId,
            fileName: link.fileName,
            folder: link.folder,
            createdAt: link.createdAt.toISOString(),
            webUrl: null,
            downloadUrl: null,
            lastModifiedDateTime: null,
            size: null,
            existsInSharePoint: false,
          }
        }
      }),
    )

    return NextResponse.json({ documents: withMetadata })
  } catch (error) {
    console.error("[task documents list error]", error)
    return NextResponse.json({ error: "failed to load linked documents" }, { status: 500 })
  }
}

async function linkTaskDocument(
  request: Request,
  { params }: TaskRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const folderRaw = toRequiredTrimmedString(payload.folder)
  const folder = folderRaw ? normalizeClientDocumentFolder(folderRaw) : null
  const fileId = toRequiredTrimmedString(payload.fileId)
  const fileName = toRequiredTrimmedString(payload.fileName)

  if (!folder || !fileId || !fileName) {
    return NextResponse.json({ error: "folder, fileId and fileName are required" }, { status: 400 })
  }

  try {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const existing = await db.taskDocumentLink.findFirst({
      where: {
        taskId: id,
        sharepointDriveItemId: fileId,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      return NextResponse.json({ error: "document already linked to this task" }, { status: 409 })
    }

    const link = await db.taskDocumentLink.create({
      data: {
        taskId: id,
        sharepointDriveItemId: fileId,
        fileName,
        folder,
      },
    })

    return NextResponse.json(
      {
        document: {
          id: link.id,
          taskId: link.taskId,
          sharepointDriveItemId: link.sharepointDriveItemId,
          fileName: link.fileName,
          folder: link.folder,
          createdAt: link.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[task document link error]", error)
    return NextResponse.json({ error: "failed to link document" }, { status: 500 })
  }
}

export const POST = withAuditTrail<TaskRouteContext>(linkTaskDocument, {
  entity_type: "TaskDocumentLink",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseDocumentLinkId(auditContext)
    return id ? loadTaskDocumentLinkSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) =>
    responseDocumentLinkId(auditContext),
  metadataFn: async (_request, context, auditContext) => {
    const payload = await responseJson<{
      document?: {
        id?: unknown
        sharepointDriveItemId?: unknown
        fileName?: unknown
        folder?: unknown
      }
    }>(auditContext)

    return {
      task_id: await taskRouteId(context),
      task_document_link_id:
        typeof payload?.document?.id === "string" ? payload.document.id : null,
      sharepoint_drive_item_id:
        typeof payload?.document?.sharepointDriveItemId === "string"
          ? payload.document.sharepointDriveItemId
          : null,
      file_name:
        typeof payload?.document?.fileName === "string"
          ? payload.document.fileName
          : null,
      folder:
        typeof payload?.document?.folder === "string" ? payload.document.folder : null,
    }
  },
})
