import { randomUUID } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { extractTasks } from "@/lib/azureOpenAI"
import { db } from "@/lib/db"

type ExtractTasksPayload = {
  file_note_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parsePayload(payload: Prisma.JsonValue): ExtractTasksPayload {
  if (!isRecord(payload)) {
    throw new Error("extract_tasks payload must be an object")
  }

  const fileNoteId = payload.file_note_id
  if (typeof fileNoteId !== "string" || !fileNoteId.trim()) {
    throw new Error("extract_tasks payload missing file_note_id")
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

function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function extractTasksJob(payloadJson: Prisma.JsonValue) {
  const payload = parsePayload(payloadJson)
  const [fileNote, taskTypeRows] = await Promise.all([
    db.file_note.findUnique({
      where: { id: payload.file_note_id },
      select: {
        id: true,
        source_type: true,
        transcript_id: true,
        party: {
          select: {
            display_name: true,
          },
        },
        meeting_transcript: {
          select: {
            id: true,
            transcript_text: true,
            speaker_name_map: true,
          },
        },
      },
    }),
    db.taskTypeOption.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { type: "asc" }, { subtype: "asc" }],
      select: {
        type: true,
        subtype: true,
      },
    }),
  ])

  if (!fileNote) {
    throw new Error("source file_note not found for extract_tasks job")
  }

  if (fileNote.source_type !== "transcript") {
    throw new Error("extract_tasks requires file_note.source_type='transcript'")
  }

  if (!fileNote.transcript_id || !fileNote.meeting_transcript) {
    throw new Error("extract_tasks requires a linked meeting_transcript")
  }

  const taskTypeOptions = Array.from(new Set(taskTypeRows.map((row) => row.type))).map((type) => ({ type }))
  const taskSubtypeOptions = taskTypeRows
    .filter((row): row is { type: string; subtype: string } => Boolean(row.subtype))
    .map((row) => ({
      type: row.type,
      subtype: row.subtype,
    }))

  const extracted = await extractTasks({
    transcriptText: fileNote.meeting_transcript.transcript_text,
    speakerNameMap: jsonObject(fileNote.meeting_transcript.speaker_name_map),
    clientName: fileNote.party?.display_name ?? null,
    taskTypeOptions,
    taskSubtypeOptions,
  })

  const tasksWithIds = extracted.tasks.map((task) => ({
    id: randomUUID(),
    ...task,
  }))

  await db.file_note.update({
    where: { id: fileNote.id },
    data: {
      extracted_tasks: toJsonCompatible(tasksWithIds),
      task_extraction_at: extracted.generatedAt,
      task_extraction_model: extracted.model,
      task_extraction_prompt_version: extracted.promptVersion,
    },
  })

  return {
    file_note_id: fileNote.id,
    meeting_transcript_id: fileNote.meeting_transcript.id,
    model: extracted.model,
    prompt_version: extracted.promptVersion,
    generated_at: extracted.generatedAt.toISOString(),
    task_count: tasksWithIds.length,
    tasks: tasksWithIds,
  }
}
