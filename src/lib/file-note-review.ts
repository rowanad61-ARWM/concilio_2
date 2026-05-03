import "server-only"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RECORDER_PLACEHOLDER_PREFIXES = [
  "Recording uploaded. Transcript pending.",
  "Partial recording uploaded. Transcript pending.",
]

type SessionLike = {
  user?: {
    id?: unknown
    email?: unknown
  }
} | null

export type ReviewActor = {
  id: string
  email: string
  name: string
  role: string
}

export type FileNoteAccessContext = {
  id: string
  party_id: string | null
  author_user_id: string
  engagement: {
    primary_adviser_id: string | null
  } | null
  party: {
    client_classification: {
      assigned_adviser_id: string | null
    } | null
  } | null
}

export type SpeakerSegment = {
  speaker_id: number
  start: number
  end: number
  text: string
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

export function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
    ),
  ) as Prisma.InputJsonValue
}

export function isMeaningfulFileNoteText(value: string | null | undefined): value is string {
  const text = value?.trim()
  if (!text) {
    return false
  }

  return !RECORDER_PLACEHOLDER_PREFIXES.some((prefix) => text.startsWith(prefix))
}

export function draftContentFromFileNote(text: string | null | undefined, aiDraft: string | null | undefined) {
  if (isMeaningfulFileNoteText(text)) {
    return text.trim()
  }

  return aiDraft?.trim() ?? ""
}

export function jsonStringMap(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([_key, nestedValue]) => typeof nestedValue === "string")
      .map(([key, nestedValue]) => [key, (nestedValue as string).trim()])
      .filter(([_key, nestedValue]) => nestedValue.length > 0),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function parseSpeakerSegments(value: Prisma.JsonValue | null | undefined): SpeakerSegment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((segment) => {
      if (!isRecord(segment)) {
        return null
      }

      const speakerId = numberValue(segment.speaker_id)
      const start = numberValue(segment.start)
      const end = numberValue(segment.end)
      const text = typeof segment.text === "string" ? segment.text.trim() : ""
      if (speakerId === null || start === null || end === null || !text) {
        return null
      }

      return {
        speaker_id: speakerId,
        start,
        end,
        text,
      }
    })
    .filter((segment): segment is SpeakerSegment => Boolean(segment))
}

export function renderTranscriptForReview(
  transcriptText: string,
  segments: SpeakerSegment[],
  speakerNameMap: Record<string, string>,
) {
  if (segments.length === 0) {
    return transcriptText
  }

  return segments
    .map((segment) => {
      const key = String(segment.speaker_id)
      const speakerName = speakerNameMap[key]?.trim() || `Speaker ${segment.speaker_id}`
      return `${speakerName}: ${segment.text}`
    })
    .join("\n")
}

function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function resolveReviewActor(session: SessionLike): Promise<ReviewActor | null> {
  const sessionUserId = maybeString(session?.user?.id)
  const email = maybeString(session?.user?.email)

  if (!sessionUserId && !email) {
    return null
  }

  const user = await db.user_account.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(sessionUserId ? [{ auth_subject: sessionUserId }] : []),
        ...(isUuid(sessionUserId) ? [{ id: sessionUserId }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  })

  if (!user || user.status !== "active") {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

export function canReviewFileNote(actor: ReviewActor, fileNote: FileNoteAccessContext) {
  const role = actor.role.toLowerCase()
  if (["admin", "owner", "principal", "practice_admin"].includes(role)) {
    return true
  }

  const assignedIds = [
    fileNote.engagement?.primary_adviser_id ?? null,
    fileNote.party?.client_classification?.assigned_adviser_id ?? null,
  ].filter((value): value is string => Boolean(value))

  if (assignedIds.includes(actor.id) || fileNote.author_user_id === actor.id) {
    return true
  }

  return assignedIds.length === 0 && ["adviser", "staff"].includes(role)
}

export async function loadFileNoteAccessContext(fileNoteId: string): Promise<FileNoteAccessContext | null> {
  if (!isUuid(fileNoteId)) {
    return null
  }

  return db.file_note.findUnique({
    where: { id: fileNoteId },
    select: {
      id: true,
      party_id: true,
      author_user_id: true,
      engagement: {
        select: {
          primary_adviser_id: true,
        },
      },
      party: {
        select: {
          client_classification: {
            select: {
              assigned_adviser_id: true,
            },
          },
        },
      },
    },
  })
}
