import { randomUUID } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { extractFacts } from "@/lib/azureOpenAI"
import { db } from "@/lib/db"
import { EXTRACTABLE_FACTS, PARK_ONLY_CATEGORIES } from "@/lib/extractable-facts"

type ExtractFactsPayload = {
  file_note_id: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parsePayload(payload: Prisma.JsonValue): ExtractFactsPayload {
  if (!isRecord(payload)) {
    throw new Error("extract_facts payload must be an object")
  }

  const fileNoteId = payload.file_note_id
  if (typeof fileNoteId !== "string" || !fileNoteId.trim()) {
    throw new Error("extract_facts payload missing file_note_id")
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

function scalarToSnapshotValue(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString()
  }

  return value
}

async function loadCurrentValues(partyId: string, householdId: string | null) {
  const [person, employmentProfile, centrelinkDetail, householdGroup] = await Promise.all([
    db.person.findUnique({ where: { id: partyId } }),
    db.employment_profile.findFirst({
      where: { party_id: partyId, effective_to: null },
      orderBy: [{ effective_from: "desc" }, { created_at: "desc" }],
    }),
    db.centrelink_detail.findUnique({ where: { person_id: partyId } }),
    householdId ? db.household_group.findUnique({ where: { id: householdId } }) : Promise.resolve(null),
  ])

  const rows: Record<string, Record<string, unknown> | null> = {
    person,
    employment_profile: employmentProfile,
    centrelink_detail: centrelinkDetail,
    household_group: householdGroup,
  }

  return Object.fromEntries(
    EXTRACTABLE_FACTS.map((fact) => {
      const row = rows[fact.table]
      const value = row ? row[fact.column] : null
      return [`${fact.table}.${fact.column}`, scalarToSnapshotValue(value)]
    }),
  )
}

export async function extractFactsJob(payloadJson: Prisma.JsonValue) {
  const payload = parsePayload(payloadJson)
  const fileNote = await db.file_note.findUnique({
    where: { id: payload.file_note_id },
    select: {
      id: true,
      source_type: true,
      transcript_id: true,
      household_id: true,
      party: {
        select: {
          id: true,
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
  })

  if (!fileNote) {
    throw new Error("source file_note not found for extract_facts job")
  }

  if (fileNote.source_type !== "transcript") {
    throw new Error("extract_facts requires file_note.source_type='transcript'")
  }

  if (!fileNote.party) {
    throw new Error("extract_facts requires file_note.party_id")
  }

  if (!fileNote.transcript_id || !fileNote.meeting_transcript) {
    throw new Error("extract_facts requires a linked meeting_transcript")
  }

  const currentValues = await loadCurrentValues(fileNote.party.id, fileNote.household_id)
  const extracted = await extractFacts({
    transcriptText: fileNote.meeting_transcript.transcript_text,
    speakerNameMap: jsonObject(fileNote.meeting_transcript.speaker_name_map),
    clientName: fileNote.party.display_name,
    extractableFacts: EXTRACTABLE_FACTS,
    parkOnlyCategories: PARK_ONLY_CATEGORIES,
    currentValues,
  })

  const factsWithIds = extracted.facts.map((fact) => ({
    id: randomUUID(),
    ...fact,
  }))

  await db.file_note.update({
    where: { id: fileNote.id },
    data: {
      extracted_facts: toJsonCompatible(factsWithIds),
      fact_extraction_at: extracted.generatedAt,
      fact_extraction_model: extracted.model,
      fact_extraction_prompt_version: extracted.promptVersion,
    },
  })

  return {
    file_note_id: fileNote.id,
    meeting_transcript_id: fileNote.meeting_transcript.id,
    model: extracted.model,
    prompt_version: extracted.promptVersion,
    generated_at: extracted.generatedAt.toISOString(),
    fact_count: factsWithIds.length,
    facts: factsWithIds,
  }
}
