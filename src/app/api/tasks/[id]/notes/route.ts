import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  loadTaskNoteSnapshot,
  responseJson,
  responseNoteId,
  taskRouteId,
  type TaskRouteContext,
} from "@/lib/task-audit-snapshots"

const DEFAULT_PAGE_SIZE = 50
const MAX_NOTE_BODY_LENGTH = 10000

function parseBeforeCursor(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const beforeCursor = parseBeforeCursor(searchParams.get("before"))

  if (beforeCursor === undefined) {
    return NextResponse.json({ error: "invalid before cursor" }, { status: 400 })
  }

  try {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const notes = await db.taskNote.findMany({
      where: {
        taskId: id,
        ...(beforeCursor
          ? {
              createdAt: {
                lt: beforeCursor,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: DEFAULT_PAGE_SIZE,
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

    return NextResponse.json({
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        source: note.source,
        createdAt: note.createdAt.toISOString(),
        author: note.author
          ? {
              id: note.author.id,
              fullName: note.author.name,
              email: note.author.email,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error(`[task notes list error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load task notes" }, { status: 500 })
  }
}

async function createTaskNote(
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

  if (typeof payload.body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 })
  }

  const body = payload.body.trim()
  if (!body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 })
  }

  if (body.length > MAX_NOTE_BODY_LENGTH) {
    return NextResponse.json(
      { error: `body exceeds ${MAX_NOTE_BODY_LENGTH} characters` },
      { status: 400 },
    )
  }

  try {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const authorEmail = session.user?.email?.trim().toLowerCase() ?? ""
    const author = authorEmail
      ? await db.user_account.findUnique({
          where: {
            email: authorEmail,
          },
          select: {
            id: true,
          },
        })
      : null

    const note = await db.taskNote.create({
      data: {
        taskId: id,
        authorId: author?.id ?? null,
        body,
        source: "CONCILIO",
      },
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

    return NextResponse.json(
      {
        note: {
          id: note.id,
          body: note.body,
          source: note.source,
          createdAt: note.createdAt.toISOString(),
          author: note.author
            ? {
                id: note.author.id,
                fullName: note.author.name,
                email: note.author.email,
              }
            : null,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error(`[task note create error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to create task note" }, { status: 500 })
  }
}

export const POST = withAuditTrail<TaskRouteContext>(createTaskNote, {
  entity_type: "TaskNote",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseNoteId(auditContext)
    return id ? loadTaskNoteSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseNoteId(auditContext),
  metadataFn: async (_request, context, auditContext) => {
    const payload = await responseJson<{
      note?: { id?: unknown; source?: unknown; author?: { id?: unknown } | null }
    }>(auditContext)

    return {
      task_id: await taskRouteId(context),
      task_note_id: typeof payload?.note?.id === "string" ? payload.note.id : null,
      source:
        typeof payload?.note?.source === "string" ? payload.note.source : null,
      author_id:
        typeof payload?.note?.author?.id === "string" ? payload.note.author.id : null,
    }
  },
})
