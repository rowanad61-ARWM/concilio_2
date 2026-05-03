import "server-only"

import type { Prisma } from "@prisma/client"

import {
  EXTRACTABLE_FACTS,
  PARK_ONLY_CATEGORIES,
  resolveTableColumnTarget,
  type ExtractableFact,
} from "@/lib/extractable-facts"
import { toJsonCompatible } from "@/lib/file-note-review"

export type PublishFactAction = "update" | "park" | "drop"

export type PublishFactInput = {
  id: string
  action: PublishFactAction
  target: {
    table: string
    column: string
    party_scope: "primary" | "household"
  } | null
  value_to_write: string | number | boolean | null
  parked_summary: string | null
  parked_category: string | null
  parked_notes: string | null
  source_quote: string | null
  raw_extract: Record<string, unknown>
  summary: string | null
  category: string | null
  current_value: string | number | boolean | null
  confidence: string | null
}

export type FactFieldAuditEvent = {
  entityType: string
  entityId: string
  beforeState: Record<string, unknown>
  afterState: Record<string, unknown>
  metadata: Record<string, unknown>
}

type FileNoteFactContext = {
  id: string
  party_id: string | null
  household_id: string | null
}

type ApplyFactDecisionResult = {
  decisions: Array<Record<string, unknown>>
  auditEvents: FactFieldAuditEvent[]
  counts: {
    facts_extracted: number
    facts_updated: number
    facts_parked: number
    facts_dropped: number
    facts_conflicts_resolved: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function scalarValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  return undefined
}

export function parsePublishFacts(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, "facts")) {
    return { facts: null as PublishFactInput[] | null }
  }

  if (!Array.isArray(payload.facts)) {
    return { error: "facts must be an array" }
  }

  const facts: PublishFactInput[] = []
  for (let index = 0; index < payload.facts.length; index += 1) {
    const normalized = normalizePublishFact(payload.facts[index], index)
    if ("error" in normalized) {
      return { error: normalized.error }
    }
    facts.push(normalized)
  }

  return { facts }
}

function normalizePublishFact(value: unknown, index: number): PublishFactInput | { error: string } {
  if (!isRecord(value)) {
    return { error: `fact ${index + 1} must be an object` }
  }

  const id = nullableString(value.id) ?? `fact-${index + 1}`
  const action = nullableString(value.action)
  if (action !== "update" && action !== "park" && action !== "drop") {
    return { error: `fact ${index + 1} has invalid action` }
  }

  const valueToWrite = scalarValue(value.value_to_write)
  const currentValue = scalarValue(value.current_value)
  if (valueToWrite === undefined || currentValue === undefined) {
    return { error: `fact ${index + 1} contains invalid scalar value` }
  }

  let target: PublishFactInput["target"] = null
  if (value.target !== null && value.target !== undefined) {
    if (!isRecord(value.target)) {
      return { error: `fact ${index + 1} target must be an object` }
    }

    const table = nullableString(value.target.table)
    const column = nullableString(value.target.column)
    const partyScope = nullableString(value.target.party_scope)
    if (!table || !column || (partyScope !== "primary" && partyScope !== "household")) {
      return { error: `fact ${index + 1} target is invalid` }
    }

    target = { table, column, party_scope: partyScope }
  }

  if (action === "update" && !target) {
    return { error: `fact ${index + 1} update requires a target` }
  }

  const parkedCategoryValue = nullableString(value.parked_category)
  const parkedSummaryValue = nullableString(value.parked_summary)
  const parkedCategory = parkedCategoryValue === undefined ? null : parkedCategoryValue
  const parkedSummary = parkedSummaryValue === undefined ? null : parkedSummaryValue
  if (action === "park") {
    if (!parkedCategory) {
      return { error: `fact ${index + 1} park action requires a category` }
    }
    if (!parkedSummary) {
      return { error: `fact ${index + 1} park action requires a summary` }
    }
  }

  return {
    id,
    action,
    target,
    value_to_write: valueToWrite,
    parked_summary: parkedSummary,
    parked_category: parkedCategory,
    parked_notes: nullableString(value.parked_notes) ?? null,
    source_quote: nullableString(value.source_quote) ?? null,
    raw_extract: isRecord(value.raw_extract) ? value.raw_extract : {},
    summary: nullableString(value.summary) ?? null,
    category: nullableString(value.category) ?? null,
    current_value: currentValue,
    confidence: nullableString(value.confidence) ?? null,
  }
}

function valueForColumn(fact: ExtractableFact, value: string | number | boolean | null) {
  if (value === null) {
    return null
  }

  if (fact.value_type === "boolean") {
    if (typeof value === "boolean") {
      return value
    }
    const text = String(value).trim().toLowerCase()
    if (["true", "yes", "y"].includes(text)) return true
    if (["false", "no", "n"].includes(text)) return false
    throw new Error(`${fact.table}.${fact.column} requires a boolean value`)
  }

  if (fact.value_type === "integer") {
    const parsed = typeof value === "number" ? value : Number(String(value).trim())
    if (!Number.isInteger(parsed)) {
      throw new Error(`${fact.table}.${fact.column} requires an integer value`)
    }
    return parsed
  }

  if (fact.value_type === "decimal") {
    const text = String(value).trim()
    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new Error(`${fact.table}.${fact.column} requires a non-negative decimal value`)
    }
    return text
  }

  if (fact.value_type === "date") {
    const text = String(value).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error(`${fact.table}.${fact.column} requires an ISO date value`)
    }
    return new Date(`${text}T00:00:00.000Z`)
  }

  const text = String(value).trim()
  return text ? text : null
}

function snapshotValue(value: unknown) {
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

function valuesDiffer(left: unknown, right: unknown) {
  return String(left ?? "") !== String(right ?? "")
}

async function applyUpdateFact({
  tx,
  fact,
  value,
  fileNote,
  actorId,
  sourceFactId,
}: {
  tx: Prisma.TransactionClient
  fact: ExtractableFact
  value: string | number | boolean | null
  fileNote: FileNoteFactContext
  actorId: string
  sourceFactId: string
}) {
  if (!fileNote.party_id) {
    throw new Error("file note must be linked to a client before facts can be published")
  }

  const writeValue = valueForColumn(fact, value)

  if (fact.table === "person") {
    const before = await tx.person.findUnique({ where: { id: fileNote.party_id } })
    if (!before) {
      throw new Error("person row not found for fact update")
    }

    const updated = await tx.person.update({
      where: { id: fileNote.party_id },
      data: { [fact.column]: writeValue } as Prisma.personUpdateInput,
    })

    return {
      entityType: "person",
      entityId: updated.id,
      beforeValue: snapshotValue(before[fact.column as keyof typeof before]),
      afterValue: snapshotValue(updated[fact.column as keyof typeof updated]),
      audit: buildFieldAudit("person", updated.id, fact, before[fact.column as keyof typeof before], updated[fact.column as keyof typeof updated], fileNote, actorId, sourceFactId),
    }
  }

  if (fact.table === "centrelink_detail") {
    const before = await tx.centrelink_detail.findUnique({ where: { person_id: fileNote.party_id } })
    const updated = before
      ? await tx.centrelink_detail.update({
          where: { person_id: fileNote.party_id },
          data: { [fact.column]: writeValue } as Prisma.centrelink_detailUpdateInput,
        })
      : await tx.centrelink_detail.create({
          data: {
            person_id: fileNote.party_id,
            [fact.column]: writeValue,
          } as Prisma.centrelink_detailUncheckedCreateInput,
        })

    return {
      entityType: "centrelink_detail",
      entityId: updated.id,
      beforeValue: snapshotValue(before?.[fact.column as keyof typeof before] ?? null),
      afterValue: snapshotValue(updated[fact.column as keyof typeof updated]),
      audit: buildFieldAudit("centrelink_detail", updated.id, fact, before?.[fact.column as keyof typeof before] ?? null, updated[fact.column as keyof typeof updated], fileNote, actorId, sourceFactId),
    }
  }

  if (fact.table === "household_group") {
    if (!fileNote.household_id) {
      throw new Error(`cannot update ${fact.table}.${fact.column} because the file note has no household_id`)
    }

    const before = await tx.household_group.findUnique({ where: { id: fileNote.household_id } })
    if (!before) {
      throw new Error("household row not found for fact update")
    }

    const updated = await tx.household_group.update({
      where: { id: fileNote.household_id },
      data: { [fact.column]: writeValue } as Prisma.household_groupUpdateInput,
    })

    return {
      entityType: "household_group",
      entityId: updated.id,
      beforeValue: snapshotValue(before[fact.column as keyof typeof before]),
      afterValue: snapshotValue(updated[fact.column as keyof typeof updated]),
      audit: buildFieldAudit("household_group", updated.id, fact, before[fact.column as keyof typeof before], updated[fact.column as keyof typeof updated], fileNote, actorId, sourceFactId),
    }
  }

  if (fact.table === "employment_profile") {
    const before = await tx.employment_profile.findFirst({
      where: { party_id: fileNote.party_id, effective_to: null },
      orderBy: [{ effective_from: "desc" }, { created_at: "desc" }],
    })

    // Prompt 7 v1 employment upsert rule: update the latest active employment_profile
    // row for this party, or create one if none exists.
    const updated = before
      ? await tx.employment_profile.update({
          where: { id: before.id },
          data: { [fact.column]: writeValue } as Prisma.employment_profileUpdateInput,
        })
      : await tx.employment_profile.create({
          data: {
            party_id: fileNote.party_id,
            employment_status: fact.column === "employment_status" && writeValue ? String(writeValue) : "unknown",
            ...(fact.column === "employment_status" ? {} : { [fact.column]: writeValue }),
          } as Prisma.employment_profileUncheckedCreateInput,
        })

    return {
      entityType: "employment_profile",
      entityId: updated.id,
      beforeValue: snapshotValue(before?.[fact.column as keyof typeof before] ?? null),
      afterValue: snapshotValue(updated[fact.column as keyof typeof updated]),
      audit: buildFieldAudit("employment_profile", updated.id, fact, before?.[fact.column as keyof typeof before] ?? null, updated[fact.column as keyof typeof updated], fileNote, actorId, sourceFactId),
    }
  }

  throw new Error(`unsupported fact update table: ${fact.table}`)
}

function buildFieldAudit(
  entityType: string,
  entityId: string,
  fact: ExtractableFact,
  beforeValue: unknown,
  afterValue: unknown,
  fileNote: FileNoteFactContext,
  actorId: string,
  sourceFactId: string,
): FactFieldAuditEvent {
  return {
    entityType,
    entityId,
    beforeState: {
      [fact.column]: snapshotValue(beforeValue),
    },
    afterState: {
      [fact.column]: snapshotValue(afterValue),
    },
    metadata: {
      event: "file_note.fact_update",
      file_note_id: fileNote.id,
      source_fact_id: sourceFactId,
      party_id: fileNote.party_id,
      updated_by: actorId,
      target: `${fact.table}.${fact.column}`,
    },
  }
}

export async function applyFactPublishDecisions({
  tx,
  fileNote,
  actorId,
  facts,
}: {
  tx: Prisma.TransactionClient
  fileNote: FileNoteFactContext
  actorId: string
  facts: PublishFactInput[] | null
}): Promise<ApplyFactDecisionResult> {
  const decisions: Array<Record<string, unknown>> = []
  const auditEvents: FactFieldAuditEvent[] = []
  let factsUpdated = 0
  let factsParked = 0
  let factsDropped = 0
  let conflictsResolved = 0

  for (const fact of facts ?? []) {
    if (fact.action === "update") {
      const target = fact.target
      const targetFact = target ? resolveTableColumnTarget(target.table, target.column) : null
      if (!targetFact) {
        throw new Error(`fact target is not extractable: ${target?.table ?? "unknown"}.${target?.column ?? "unknown"}`)
      }

      const updated = await applyUpdateFact({
        tx,
        fact: targetFact,
        value: fact.value_to_write,
        fileNote,
        actorId,
        sourceFactId: fact.id,
      })
      factsUpdated += 1
      if (valuesDiffer(updated.beforeValue, updated.afterValue)) {
        conflictsResolved += fact.current_value !== null && valuesDiffer(fact.current_value, updated.afterValue) ? 1 : 0
      }
      auditEvents.push(updated.audit)
      decisions.push({
        ...fact,
        updated_entity_type: updated.entityType,
        updated_entity_id: updated.entityId,
        before_value: updated.beforeValue,
        after_value: updated.afterValue,
      })
      continue
    }

    if (fact.action === "park") {
      if (!fileNote.party_id) {
        throw new Error("file note must be linked to a client before facts can be parked")
      }

      const category = fact.parked_category || fact.category || PARK_ONLY_CATEGORIES[0]?.category || "other"
      const summary = fact.parked_summary || fact.summary || "Parked fact"
      const parked = await tx.parked_fact.create({
        data: {
          party_id: fileNote.party_id,
          category,
          summary,
          raw_extract: toJsonCompatible(fact.raw_extract),
          source_file_note_id: fileNote.id,
          parked_by: actorId,
          status: "parked",
          notes: fact.parked_notes,
        },
      })

      factsParked += 1
      decisions.push({
        ...fact,
        parked_fact_id: parked.id,
      })
      continue
    }

    factsDropped += 1
    decisions.push(fact)
  }

  return {
    decisions,
    auditEvents,
    counts: {
      facts_extracted: facts?.length ?? 0,
      facts_updated: factsUpdated,
      facts_parked: factsParked,
      facts_dropped: factsDropped,
      facts_conflicts_resolved: conflictsResolved,
    },
  }
}

export { EXTRACTABLE_FACTS, PARK_ONLY_CATEGORIES }
