import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { TIMELINE_KINDS, type TimelineKind } from "@/lib/timeline"

export const DEFAULT_TIMELINE_LIMIT = 50
export const MAX_TIMELINE_LIMIT = 200

export const QUICK_ADD_TIMELINE_KINDS = [
  "phone_call",
  "meeting",
  "file_note",
] as const

export type QuickAddTimelineKind = (typeof QUICK_ADD_TIMELINE_KINDS)[number]

export type TimelineRouteContext = { params: Promise<{ id: string }> }

type SessionLike = {
  user?: {
    id?: unknown
    email?: unknown
  }
} | null

type TimelineEntryRow = {
  id: string
  party_id: string
  household_id: string | null
  kind: string
  source: string
  external_ref: string | null
  external_designation: string | null
  title: string
  body: string | null
  actor_user_id: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  occurred_at: Date
  inserted_at: Date
  updated_at: Date
  metadata: Prisma.JsonValue | null
}

type TimelineAttachmentRow = {
  id: string
  timeline_entry_id: string
  document_id: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  inserted_at: Date
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TIMELINE_KIND_SET = new Set<string>(TIMELINE_KINDS)
const QUICK_ADD_KIND_SET = new Set<string>(QUICK_ADD_TIMELINE_KINDS)

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function isTimelineKind(value: string): value is TimelineKind {
  return TIMELINE_KIND_SET.has(value)
}

export function isQuickAddTimelineKind(value: string): value is QuickAddTimelineKind {
  return QUICK_ADD_KIND_SET.has(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseTimelineLimit(raw: string | null) {
  if (raw === null || raw.trim() === "") {
    return { ok: true as const, value: DEFAULT_TIMELINE_LIMIT }
  }

  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1) {
    return { ok: false as const, error: "limit must be a positive integer" }
  }

  return { ok: true as const, value: Math.min(limit, MAX_TIMELINE_LIMIT) }
}

export function parseIsoDateParam(raw: string | null, name: string) {
  if (raw === null || raw.trim() === "") {
    return { ok: true as const, value: null }
  }

  const value = new Date(raw)
  if (Number.isNaN(value.valueOf())) {
    return { ok: false as const, error: `${name} must be a valid ISO timestamp` }
  }

  return { ok: true as const, value }
}

export function parseTimelineKindFilter(searchParams: URLSearchParams) {
  const rawKinds = searchParams
    .getAll("kind")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)

  if (rawKinds.length === 0) {
    return { ok: true as const, value: null }
  }

  const invalid = rawKinds.find((kind) => !isTimelineKind(kind))
  if (invalid) {
    return { ok: false as const, error: `invalid kind: ${invalid}` }
  }

  return { ok: true as const, value: Array.from(new Set(rawKinds)) as TimelineKind[] }
}

export function toOptionalTrimmedString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function serializeTimelineEntry(entry: TimelineEntryRow) {
  return {
    id: entry.id,
    party_id: entry.party_id,
    household_id: entry.household_id,
    kind: entry.kind,
    source: entry.source,
    external_ref: entry.external_ref,
    external_designation: entry.external_designation,
    title: entry.title,
    body: entry.body,
    actor_user_id: entry.actor_user_id,
    related_entity_type: entry.related_entity_type,
    related_entity_id: entry.related_entity_id,
    occurred_at: entry.occurred_at.toISOString(),
    inserted_at: entry.inserted_at.toISOString(),
    updated_at: entry.updated_at.toISOString(),
    metadata: entry.metadata,
  }
}

export function serializeTimelineAttachment(attachment: TimelineAttachmentRow) {
  return {
    id: attachment.id,
    timeline_entry_id: attachment.timeline_entry_id,
    document_id: attachment.document_id,
    filename: attachment.filename,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    inserted_at: attachment.inserted_at.toISOString(),
  }
}

export async function findAccessibleClientParty(partyId: string) {
  if (!isUuid(partyId)) {
    return null
  }

  return db.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      party_type: true,
      display_name: true,
      status: true,
    },
  })
}

export async function resolveActiveHouseholdId(partyId: string): Promise<string | null> {
  const membership = await db.household_member.findFirst({
    where: {
      party_id: partyId,
      end_date: null,
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      household_id: true,
    },
  })

  return membership?.household_id ?? null
}

export async function resolveSessionActorUserId(session: SessionLike) {
  const sessionUserId = typeof session?.user?.id === "string" ? session.user.id : null
  if (sessionUserId && isUuid(sessionUserId)) {
    return sessionUserId
  }

  const email = typeof session?.user?.email === "string" ? session.user.email.trim() : ""
  if (!email && !sessionUserId) {
    return null
  }

  const user = await db.user_account.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(sessionUserId ? [{ auth_subject: sessionUserId }] : []),
      ],
    },
    select: { id: true },
  })

  return user?.id ?? null
}
