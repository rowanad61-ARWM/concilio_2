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

export async function POST(_request: Request, { params }: RouteContext) {
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

  const fileNote = await db.file_note.findUnique({
    where: { id },
    select: {
      id: true,
      source_type: true,
      transcript_id: true,
      review_state: true,
    },
  })

  if (!fileNote) {
    return NextResponse.json({ error: "file note not found" }, { status: 404 })
  }

  if (fileNote.review_state === "published") {
    return NextResponse.json({ error: "published file notes cannot be regenerated here" }, { status: 403 })
  }

  if (fileNote.source_type !== "transcript" || !fileNote.transcript_id) {
    return NextResponse.json({ error: "regeneration requires a transcript-backed file note" }, { status: 400 })
  }

  const result = await db.$transaction(async (tx) => {
    await tx.file_note.update({
      where: { id },
      data: {
        text: "",
        ai_draft_content: null,
        generation_model: null,
        generation_prompt_version: null,
        generation_at: null,
        updated_at: new Date(),
      },
    })

    const job = await tx.processing_job.create({
      data: {
        job_type: "generate_file_note",
        payload: {
          file_note_id: id,
        },
      },
      select: {
        id: true,
        status: true,
        scheduled_at: true,
      },
    })

    return job
  })

  return NextResponse.json(
    {
      processing_job_id: result.id,
      status: result.status,
      scheduled_at: result.scheduled_at.toISOString(),
    },
    { status: 202 },
  )
}

