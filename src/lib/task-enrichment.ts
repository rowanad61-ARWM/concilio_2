import { normalizeClientDocumentFolder, type ClientDocumentFolder } from "@/lib/documents"
import type { Prisma, TaskStatus } from "@prisma/client"

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

type RecurrenceAdvanceTask = {
  id: string
  clientId: string
  title: string
  description: string | null
  type: string
  subtype: string | null
  status: string
  dueDateStart: Date | null
  dueDateEnd: Date | null
  isRecurring: boolean
  recurrenceCadence: string | null
  recurrenceEndDate: Date | null
  recurrenceCount: number | null
  parentTaskId: string | null
  owners: Array<{
    userId: string
  }>
}

const LIVE_SERIES_STATUS_VALUES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS"]

export async function maybeCreateNextRecurringTask(
  tx: Prisma.TransactionClient,
  params: {
    previousStatus: string
    task: RecurrenceAdvanceTask
  },
) {
  const { task, previousStatus } = params

  const transitionedToTerminal =
    !isTerminalSeriesStatus(previousStatus) && isTerminalSeriesStatus(task.status)
  if (!transitionedToTerminal || !task.isRecurring || !task.recurrenceCadence || !task.dueDateStart) {
    return null
  }

  if (!isRecurrenceCadence(task.recurrenceCadence)) {
    return null
  }

  const recurrenceRootId = task.parentTaskId ?? task.id

  const hasLiveInstance = await tx.task.findFirst({
    where: {
      id: {
        not: task.id,
      },
      OR: [{ id: recurrenceRootId }, { parentTaskId: recurrenceRootId }],
      status: {
        in: LIVE_SERIES_STATUS_VALUES,
      },
    },
    select: {
      id: true,
    },
  })

  if (hasLiveInstance) {
    return null
  }

  const seriesCount = await tx.task.count({
    where: {
      OR: [{ id: recurrenceRootId }, { parentTaskId: recurrenceRootId }],
    },
  })

  if (task.recurrenceCount && seriesCount >= task.recurrenceCount) {
    return null
  }

  const nextDueStart = addCadence(task.dueDateStart, task.recurrenceCadence)
  const nextDueEnd = task.dueDateEnd ? addCadence(task.dueDateEnd, task.recurrenceCadence) : null

  if (task.recurrenceEndDate && nextDueStart.getTime() > task.recurrenceEndDate.getTime()) {
    return null
  }

  const recurringTask = await tx.task.create({
    data: {
      clientId: task.clientId,
      title: task.title,
      description: task.description,
      type: task.type,
      subtype: task.subtype,
      status: "NOT_STARTED",
      dueDateStart: nextDueStart,
      dueDateEnd: nextDueEnd,
      completedAt: null,
      isRecurring: true,
      recurrenceCadence: task.recurrenceCadence,
      recurrenceEndDate: task.recurrenceEndDate,
      recurrenceCount: task.recurrenceCount,
      parentTaskId: recurrenceRootId,
      owners:
        task.owners.length > 0
          ? {
              create: task.owners.map((owner) => ({ userId: owner.userId })),
            }
          : undefined,
    },
  })

  return recurringTask.id
}
