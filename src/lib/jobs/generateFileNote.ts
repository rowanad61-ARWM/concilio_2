import type { Prisma } from "@prisma/client"

import { generateFileNoteDraft } from "@/lib/azureOpenAI"
import { db } from "@/lib/db"

type GenerateFileNotePayload = {
  file_note_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parsePayload(payload: Prisma.JsonValue): GenerateFileNotePayload {
  if (!isRecord(payload)) {
    throw new Error("generate_file_note payload must be an object")
  }

  const fileNoteId = payload.file_note_id
  if (typeof fileNoteId !== "string" || !fileNoteId.trim()) {
    throw new Error("generate_file_note payload missing file_note_id")
  }

  return { file_note_id: fileNoteId.trim() }
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([_key, nestedValue]) => typeof nestedValue === "string")
      .map(([key, nestedValue]) => [key, nestedValue as string]),
  )
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value)
}

export async function generateFileNoteJob(payloadJson: Prisma.JsonValue) {
  const payload = parsePayload(payloadJson)
  const fileNote = await db.file_note.findUnique({
    where: { id: payload.file_note_id },
    select: {
      id: true,
      source_type: true,
      transcript_id: true,
      review_state: true,
      party: {
        select: {
          display_name: true,
        },
      },
      engagement: {
        select: {
          id: true,
          engagement_type: true,
          meeting_type_key: true,
          meeting_modality: true,
          opened_at: true,
          completed_at: true,
          calendly_event_uuid: true,
        },
      },
      meeting_transcript: {
        select: {
          id: true,
          transcript_text: true,
          speaker_name_map: true,
          transcription_at: true,
        },
      },
    },
  })

  if (!fileNote) {
    throw new Error("source file_note not found for generate_file_note job")
  }

  if (fileNote.source_type !== "transcript") {
    throw new Error("generate_file_note requires file_note.source_type='transcript'")
  }

  if (!fileNote.transcript_id || !fileNote.meeting_transcript) {
    throw new Error("generate_file_note requires a linked meeting_transcript")
  }

  const engagementMeta = fileNote.engagement
    ? {
        date: formatDate(fileNote.engagement.opened_at),
        completed_date: formatDate(fileNote.engagement.completed_at),
        type: fileNote.engagement.engagement_type,
        meeting_type_key: fileNote.engagement.meeting_type_key,
        modality: fileNote.engagement.meeting_modality,
        calendly_event_uuid: fileNote.engagement.calendly_event_uuid,
      }
    : {
        transcript_date: formatDate(fileNote.meeting_transcript.transcription_at),
      }

  const generated = await generateFileNoteDraft({
    transcriptText: fileNote.meeting_transcript.transcript_text,
    speakerNameMap: jsonObject(fileNote.meeting_transcript.speaker_name_map),
    clientName: fileNote.party?.display_name ?? null,
    engagementMeta,
  })

  await db.file_note.update({
    where: { id: fileNote.id },
    data: {
      ai_draft_content: generated.draftContent,
      generation_model: generated.model,
      generation_prompt_version: generated.promptVersion,
      generation_at: generated.generatedAt,
    },
  })

  return {
    file_note_id: fileNote.id,
    meeting_transcript_id: fileNote.meeting_transcript.id,
    model: generated.model,
    prompt_version: generated.promptVersion,
    generated_at: generated.generatedAt.toISOString(),
    draft_preview: generated.draftContent.slice(0, 500),
    draft_word_count: generated.draftContent.trim().split(/\s+/).filter(Boolean).length,
  }
}
