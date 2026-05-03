import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  canReviewFileNote,
  loadFileNoteAccessContext,
  resolveReviewActor,
} from "@/lib/file-note-review"

type RouteContext = {
  params: Promise<{ id: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth()
  const actor = await resolveReviewActor(session)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const accessContext = await loadFileNoteAccessContext(id)
  if (!accessContext || !canReviewFileNote(actor, accessContext)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as unknown
  if (!isRecord(payload) || typeof payload.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
  }

  if (payload.content.length > 50000) {
    return NextResponse.json({ error: "content must be 50000 characters or fewer" }, { status: 400 })
  }

  const fileNote = await db.file_note.findUnique({
    where: { id },
    select: {
      id: true,
      review_state: true,
    },
  })

  if (!fileNote) {
    return NextResponse.json({ error: "file note not found" }, { status: 404 })
  }

  if (fileNote.review_state === "published") {
    return NextResponse.json({ error: "published file notes are read-only here" }, { status: 403 })
  }

  const updated = await db.file_note.update({
    where: { id },
    data: {
      text: payload.content,
      updated_at: new Date(),
    },
    select: {
      id: true,
      text: true,
      updated_at: true,
    },
  })

  return NextResponse.json({
    id: updated.id,
    content: updated.text,
    updated_at: updated.updated_at.toISOString(),
  })
}

