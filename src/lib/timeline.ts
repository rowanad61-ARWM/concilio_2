import type { Prisma } from '@prisma/client'

import { db } from '@/lib/db'

const TIMELINE_KINDS = [
  'email_in',
  'email_out',
  'sms_in',
  'sms_out',
  'phone_call',
  'meeting',
  'file_note',
  'document',
  'portal_message',
  'workflow_event',
  'alert',
  'task',
  'system',
] as const

export type TimelineKind = (typeof TIMELINE_KINDS)[number]

const TIMELINE_SOURCES = ['native', 'xplan', 'manual_import'] as const

export type TimelineSource = (typeof TIMELINE_SOURCES)[number]

export type TimelineEntryInput = {
  party_id: string
  household_id?: string | null
  kind: TimelineKind
  source?: TimelineSource
  external_ref?: string | null
  external_designation?: string | null
  title: string
  body?: string | null
  actor_user_id?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
  occurred_at?: Date
  metadata?: Record<string, unknown> | null
}

type TimelineDbClient = Prisma.TransactionClient | typeof db

const TIMELINE_KIND_SET = new Set<string>(TIMELINE_KINDS)
const TIMELINE_SOURCE_SET = new Set<string>(TIMELINE_SOURCES)

function toJsonCompatible(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
    ),
  ) as Prisma.InputJsonValue
}

function isValidKind(kind: string): kind is TimelineKind {
  return TIMELINE_KIND_SET.has(kind)
}

function isValidSource(source: string): source is TimelineSource {
  return TIMELINE_SOURCE_SET.has(source)
}

export async function writeTimelineEntry(
  input: TimelineEntryInput,
  opts?: { tx?: Prisma.TransactionClient },
): Promise<void> {
  const source = input.source ?? 'native'

  if (!isValidKind(input.kind)) {
    console.error('[Timeline] Skipped invalid kind', {
      kind: input.kind,
      party_id: input.party_id,
      related_entity_type: input.related_entity_type,
      related_entity_id: input.related_entity_id,
    })
    return
  }

  if (!isValidSource(source)) {
    console.error('[Timeline] Skipped invalid source', {
      source,
      party_id: input.party_id,
      kind: input.kind,
      related_entity_type: input.related_entity_type,
      related_entity_id: input.related_entity_id,
    })
    return
  }

  try {
    const client: TimelineDbClient = opts?.tx ?? db
    await client.timeline_entry.create({
      data: {
        party_id: input.party_id,
        household_id: input.household_id ?? null,
        kind: input.kind,
        source,
        external_ref: input.external_ref ?? null,
        external_designation: input.external_designation ?? null,
        title: input.title,
        body: input.body ?? null,
        actor_user_id: input.actor_user_id ?? null,
        related_entity_type: input.related_entity_type ?? null,
        related_entity_id: input.related_entity_id ?? null,
        occurred_at: input.occurred_at ?? new Date(),
        metadata: input.metadata ? toJsonCompatible(input.metadata) : undefined,
      },
    })
  } catch (error) {
    console.error('[Timeline] Failed to write timeline_entry; caller will continue', {
      error,
      party_id: input.party_id,
      kind: input.kind,
      related_entity_type: input.related_entity_type,
      related_entity_id: input.related_entity_id,
    })
  }
}
