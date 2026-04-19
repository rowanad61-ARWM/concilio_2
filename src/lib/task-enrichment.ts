import { normalizeClientDocumentFolder, type ClientDocumentFolder } from "@/lib/documents"

export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_EXTERNAL",
  "WAITING_INTERNAL",
  "NEEDS_REVIEW",
  "WITH_CLIENT",
  "STUCK",
  "ON_HOLD",
  "DONE",
  "CANCELLED",
] as const

export const RECURRENCE_CADENCES = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "YEARLY",
] as const

export const LIVE_SERIES_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const
export const TERMINAL_SERIES_STATUSES = ["DONE", "CANCELLED"] as const

export type TaskStatusValue = (typeof TASK_STATUSES)[number]
export type RecurrenceCadenceValue = (typeof RECURRENCE_CADENCES)[number]

export type ParsedField<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export type NormalizedDocumentLinkInput = {
  sharepointDriveItemId: string
  fileName: string
  folder: ClientDocumentFolder
}

export function isTaskStatus(value: string): value is TaskStatusValue {
  return TASK_STATUSES.includes(value as TaskStatusValue)
}

export function isRecurrenceCadence(value: string): value is RecurrenceCadenceValue {
  return RECURRENCE_CADENCES.includes(value as RecurrenceCadenceValue)
}

export function isLiveSeriesStatus(value: string) {
  return LIVE_SERIES_STATUSES.includes(value as (typeof LIVE_SERIES_STATUSES)[number])
}

export function isTerminalSeriesStatus(value: string) {
  return TERMINAL_SERIES_STATUSES.includes(value as (typeof TERMINAL_SERIES_STATUSES)[number])
}

export function toNullableTrimmedString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function toRequiredTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

export function toNullableDate(value: unknown): Date | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed
}

export function toNullableBoolean(value: unknown): boolean | null | undefined {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "boolean") {
    return undefined
  }

  return value
}

export function toNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

export function parseOwnerIds(value: unknown): ParsedField<string[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: "owners must be an array" }
  }

  const parsed: string[] = []

  for (const item of value) {
    if (typeof item !== "string") {
      return { ok: false, error: "owners must contain user id strings" }
    }

    const trimmed = item.trim()
    if (!trimmed) {
      continue
    }

    if (!parsed.includes(trimmed)) {
      parsed.push(trimmed)
    }
  }

  return { ok: true, value: parsed }
}

export function parseDocumentLinks(value: unknown): ParsedField<NormalizedDocumentLinkInput[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: "documentLinks must be an array" }
  }

  const dedupe = new Set<string>()
  const parsed: NormalizedDocumentLinkInput[] = []

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "documentLinks must contain objects" }
    }

    const raw = item as Record<string, unknown>
    const folderRaw = toRequiredTrimmedString(raw.folder)
    const normalizedFolder = folderRaw ? normalizeClientDocumentFolder(folderRaw) : null
    if (!normalizedFolder) {
      return { ok: false, error: "documentLinks contain an invalid folder" }
    }

    const fileId = toRequiredTrimmedString(raw.fileId ?? raw.sharepointDriveItemId)
    if (!fileId) {
      return { ok: false, error: "documentLinks contain an invalid file id" }
    }

    const fileName = toRequiredTrimmedString(raw.fileName)
    if (!fileName) {
      return { ok: false, error: "documentLinks contain an invalid file name" }
    }

    const key = `${normalizedFolder}:${fileId}`
    if (dedupe.has(key)) {
      continue
    }

    dedupe.add(key)
    parsed.push({
      folder: normalizedFolder,
      sharepointDriveItemId: fileId,
      fileName,
    })
  }

  return { ok: true, value: parsed }
}

export function addCadence(date: Date, cadence: RecurrenceCadenceValue) {
  const next = new Date(date)

  if (cadence === "WEEKLY") {
    next.setDate(next.getDate() + 7)
    return next
  }

  if (cadence === "MONTHLY") {
    next.setMonth(next.getMonth() + 1)
    return next
  }

  if (cadence === "QUARTERLY") {
    next.setMonth(next.getMonth() + 3)
    return next
  }

  if (cadence === "HALF_YEARLY") {
    next.setMonth(next.getMonth() + 6)
    return next
  }

  next.setFullYear(next.getFullYear() + 1)
  return next
}