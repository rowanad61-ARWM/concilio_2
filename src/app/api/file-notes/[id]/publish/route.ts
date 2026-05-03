import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { writeAuditEvent } from "@/lib/audit"
import { db } from "@/lib/db"
import {
  canReviewFileNote,
  draftContentFromFileNote,
  isMeaningfulFileNoteText,
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

function firstForwardedIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

function clientIp(headers: Headers) {
  return (
    firstForwardedIp(headers) ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("true-client-ip")
  )
}

export async function POST(request: Request, { params }: RouteContext) {
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
      party_id: true,
      household_id: true,
      text: true,
      review_state: true,
      ai_draft_content: true,
      transcript_id: true,
      published_at: true,
      published_by: true,
    },
  })

  if (!fileNote) {
    return NextResponse.json({ error: "file note not found" }, { status: 404 })
  }

  if (fileNote.review_state === "published") {
    return NextResponse.json({ error: "file note is already published" }, { status: 409 })
  }

  const publishedContent = draftContentFromFileNote(fileNote.text, fileNote.ai_draft_content).trim()
  if (!publishedContent) {
    return NextResponse.json({ error: "file note content is required before publishing" }, { status: 400 })
  }

  const publishedAt = new Date()
  const beforeSnapshot = {
    file_note_id: fileNote.id,
    review_state: fileNote.review_state,
    text: fileNote.text,
    ai_draft_content: fileNote.ai_draft_content,
    transcript_id: fileNote.transcript_id,
    published_at: fileNote.published_at?.toISOString() ?? null,
    published_by: fileNote.published_by,
  }

  const updated = await db.$transaction(async (tx) => {
    const nextFileNote = await tx.file_note.update({
      where: { id: fileNote.id },
      data: {
        text: publishedContent,
        review_state: "published",
        published_at: publishedAt,
        published_by: actor.id,
        updated_at: publishedAt,
      },
      select: {
        id: true,
        text: true,
        review_state: true,
        published_at: true,
        published_by: true,
        transcript_id: true,
      },
    })

    const timelineEntries = await tx.timeline_entry.findMany({
      where: {
        related_entity_type: "file_note",
        related_entity_id: fileNote.id,
      },
      select: {
        id: true,
        metadata: true,
      },
    })

    for (const entry of timelineEntries) {
      const currentMetadata = isRecord(entry.metadata) ? entry.metadata : {}
      await tx.timeline_entry.update({
        where: { id: entry.id },
        data: {
          title: "File note published",
          body: publishedContent,
          updated_at: publishedAt,
          metadata: toJsonCompatible({
            ...currentMetadata,
            review_state: "published",
            published_at: publishedAt.toISOString(),
            published_by: actor.id,
          }) as Prisma.InputJsonValue,
        },
      })
    }

    return nextFileNote
  })

  const afterSnapshot = {
    file_note_id: updated.id,
    review_state: updated.review_state,
    content_published: updated.text,
    ai_draft_content: fileNote.ai_draft_content,
    transcript_id: updated.transcript_id,
    published_at: updated.published_at?.toISOString() ?? null,
    published_by: updated.published_by,
  }

  await writeAuditEvent({
    userId: actor.id,
    action: "UPDATE",
    entityType: "file_note",
    entityId: updated.id,
    channel: "staff_ui",
    actor_ip: clientIp(request.headers),
    actor_user_agent: request.headers.get("user-agent"),
    request_id: request.headers.get("x-request-id"),
    beforeState: beforeSnapshot,
    afterState: afterSnapshot,
    metadata: {
      event: "file_note.published",
      file_note_id: updated.id,
      transcript_id: updated.transcript_id,
      published_by: actor.id,
      content_published: updated.text,
      ai_draft_content: fileNote.ai_draft_content,
      had_adviser_edits: isMeaningfulFileNoteText(fileNote.text),
    },
  })

  return NextResponse.json({
    id: updated.id,
    review_state: updated.review_state,
    published_at: updated.published_at?.toISOString() ?? null,
    published_by: updated.published_by,
  })
}

