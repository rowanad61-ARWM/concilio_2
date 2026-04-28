import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  loadTaskDocumentLinkSnapshot,
  taskDocumentRouteIds,
  type TaskDocumentRouteContext,
} from "@/lib/task-audit-snapshots"

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  )
}

async function unlinkTaskDocument(
  _request: Request,
  { params }: TaskDocumentRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, linkId } = await params

  try {
    const existing = await db.taskDocumentLink.findFirst({
      where: {
        id: linkId,
        taskId: id,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "linked document not found" }, { status: 404 })
    }

    await db.taskDocumentLink.delete({
      where: {
        id: linkId,
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "linked document not found" }, { status: 404 })
    }

    console.error("[task document unlink error]", error)
    return NextResponse.json({ error: "failed to unlink document" }, { status: 500 })
  }
}

export const DELETE = withAuditTrail<TaskDocumentRouteContext>(
  unlinkTaskDocument,
  {
    entity_type: "TaskDocumentLink",
    action: "DELETE",
    beforeFn: async (_request, context) => {
      const { linkId } = await taskDocumentRouteIds(context)
      return loadTaskDocumentLinkSnapshot(linkId)
    },
    afterFn: async () => null,
    entityIdFn: async (_request, context) => {
      const { linkId } = await taskDocumentRouteIds(context)
      return linkId
    },
    metadataFn: async (_request, context) => {
      const { taskId, linkId } = await taskDocumentRouteIds(context)
      return {
        task_id: taskId,
        task_document_link_id: linkId,
      }
    },
  },
)
