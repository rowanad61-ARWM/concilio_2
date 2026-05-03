import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  canReviewFileNote,
  jsonStringMap,
  loadFileNoteAccessContext,
  resolveReviewActor,
  toJsonCompatible,
} from "@/lib/file-note-review"

type RouteContext = {
  params: Promise<{ id: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseSpeakerNameMap(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([_key, nestedValue]) => typeof nestedValue === "string")
      .map(([key, nestedValue]) => [key, (nestedValue as string).trim()])
      .filter(([_key, nestedValue]) => nestedValue.length > 0),
  )
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
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "request body must be an object" }, { status: 400 })
  }

  const fileNote = await db.file_note.findUnique({
    where: { id },
    select: {
      id: true,
      review_state: true,
      transcript_id: true,
      meeting_transcript: {
        select: {
          speaker_name_map: true,
        },
      },
    },
  })

  if (!fileNote || !fileNote.transcript_id || !fileNote.meeting_transcript) {
    return NextResponse.json({ error: "file note transcript not found" }, { status: 404 })
  }

  if (fileNote.review_state === "published") {
    return NextResponse.json({ error: "published file notes are read-only here" }, { status: 403 })
  }

  const data: Prisma.meeting_transcriptUpdateInput = {}
  if (typeof payload.transcript_text === "string") {
    data.transcript_text = payload.transcript_text
  }

  if (Object.prototype.hasOwnProperty.call(payload, "speaker_name_map")) {
    const parsed = parseSpeakerNameMap(payload.speaker_name_map)
    if (!parsed) {
      return NextResponse.json({ error: "speaker_name_map must be an object of strings" }, { status: 400 })
    }

    data.speaker_name_map = toJsonCompatible({
      ...jsonStringMap(fileNote.meeting_transcript.speaker_name_map),
      ...parsed,
    })
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 })
  }

  const transcript = await db.meeting_transcript.update({
    where: { id: fileNote.transcript_id },
    data,
    select: {
      id: true,
      transcript_text: true,
      speaker_name_map: true,
      updated_at: true,
    },
  })

  return NextResponse.json({
    id: transcript.id,
    transcript_text: transcript.transcript_text,
    speaker_name_map: transcript.speaker_name_map,
    updated_at: transcript.updated_at.toISOString(),
  })
}

