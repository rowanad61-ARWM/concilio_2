import "server-only"

import type { Prisma, TaskStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { STATUS_LABEL_TO_STATUS_MAP } from "@/lib/monday-mapping"
import { getBoardColumns, getMondayUserEmailById } from "@/lib/monday"
import { maybeCreateNextRecurringTask } from "@/lib/task-enrichment"
import { syncTaskToMonday } from "@/lib/task-sync"

const ECHO_DEBOUNCE_MS = 3000
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MONDAY_TASK_COLUMN_TITLES = {
  status: "status",
  timeline: "timeline",
  owner: "owner",
} as const

type MondayTaskWithOwners = Prisma.TaskGetPayload<{
  include: {
    owners: true
  }
}>

export type MondayEvent = {
  type?: string
  pulseId?: string | number
  boardId?: string | number
  userId?: string | number
  columnId?: string
  columnType?: string
  value?: unknown
  previousValue?: unknown
  textBody?: string
  body?: string
  createdAt?: string | number
  [key: string]: unknown
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function toNumericId(value: string | number | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim())
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))

  if (!looksJson) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function unwrapMondayValue(raw: unknown) {
  let current = parseJsonMaybe(raw)

  for (let index = 0; index < 4; index += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return current
    }

    const objectValue = current as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(objectValue, "value")) {
      return current
    }

    current = parseJsonMaybe(objectValue.value)
  }

  return current
}

function parseDateOnly(value: string | null) {
  if (!value) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  return new Date(`${value}T00:00:00.000Z`)
}

function isTerminalStatus(status: TaskStatus) {
  return status === "DONE" || status === "CANCELLED"
}

function formatActorEmail(actorEmail: string | null) {
  return actorEmail ?? "unknown user"
}

function formatDateOnly(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "none"
}

function describeTimelineRange(range: { from: string | null; to: string | null } | null | undefined) {
  if (range === undefined) {
    return "unrecognized"
  }

  if (range === null) {
    return "cleared"
  }

  const fromValue = range.from ?? "none"
  const toValue = range.to ?? range.from ?? "none"
  return `${fromValue} -> ${toValue}`
}

function extractStatusLabel(raw: unknown): string | null {
  const value = unwrapMondayValue(raw)

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const objectValue = value as Record<string, unknown>

  if (typeof objectValue.label === "string" && objectValue.label.trim()) {
    return objectValue.label.trim()
  }

  if (objectValue.label && typeof objectValue.label === "object" && !Array.isArray(objectValue.label)) {
    const labelValue = objectValue.label as Record<string, unknown>

    if (typeof labelValue.text === "string" && labelValue.text.trim()) {
      return labelValue.text.trim()
    }

    if (typeof labelValue.label === "string" && labelValue.label.trim()) {
      return labelValue.label.trim()
    }
  }

  if (typeof objectValue.text === "string" && objectValue.text.trim()) {
    return objectValue.text.trim()
  }

  return null
}

function extractTimelineRange(raw: unknown): { from: string | null; to: string | null } | null | undefined {
  const value = unwrapMondayValue(raw)

  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { from: trimmed, to: trimmed }
    }

    const parsed = parseJsonMaybe(trimmed)
    if (parsed !== trimmed) {
      return extractTimelineRange(parsed)
    }

    return undefined
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const objectValue = value as Record<string, unknown>
  if (
    Object.prototype.hasOwnProperty.call(objectValue, "timeline") &&
    objectValue.timeline &&
    typeof objectValue.timeline === "object"
  ) {
    return extractTimelineRange(objectValue.timeline)
  }

  const fromRaw = typeof objectValue.from === "string" ? objectValue.from.trim() : null
  const toRaw = typeof objectValue.to === "string" ? objectValue.to.trim() : null

  if (!fromRaw && !toRaw) {
    return Object.keys(objectValue).length === 0 ? null : undefined
  }

  const from = fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : null
  const to = toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : null

  if ((fromRaw && !from) || (toRaw && !to)) {
    return undefined
  }

  return {
    from,
    to,
  }
}

function extractOwnerIds(raw: unknown): number[] | undefined {
  const value = unwrapMondayValue(raw)
  if (value === null || value === undefined || value === "") {
    return []
  }

  let peopleRaw: unknown = null

  if (Array.isArray(value)) {
    peopleRaw = value
  } else if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>
    if (Array.isArray(objectValue.personsAndTeams)) {
      peopleRaw = objectValue.personsAndTeams
    } else if (typeof objectValue.personsAndTeams === "string") {
      const parsed = parseJsonMaybe(objectValue.personsAndTeams)
      if (Array.isArray(parsed)) {
        peopleRaw = parsed
      }
    } else if (Object.keys(objectValue).length === 0) {
      return []
    }
  }

  if (!Array.isArray(peopleRaw)) {
    return undefined
  }

  const deduped = new Set<number>()

  for (const person of peopleRaw) {
    if (!person || typeof person !== "object" || Array.isArray(person)) {
      continue
    }

    const personValue = person as Record<string, unknown>
    const kind =
      typeof personValue.kind === "string"
        ? personValue.kind.toLowerCase()
        : "person"

    if (kind !== "person") {
      continue
    }

    const id = toNumericId(
      typeof personValue.id === "number" || typeof personValue.id === "string"
        ? personValue.id
        : undefined,
    )

    if (id) {
      deduped.add(id)
    }
  }

  return Array.from(deduped)
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
}

function parseCreatedAt(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const asMs = value > 1_000_000_000_000 ? value : value * 1000
    const parsed = new Date(asMs)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

async function resolveActorEmail(mondayUserId: number | null) {
  if (!mondayUserId) {
    return null
  }

  try {
    return await getMondayUserEmailById(mondayUserId)
  } catch (error) {
    console.error(`[monday webhook] resolve-user-email failed ${mondayUserId} ${toErrorMessage(error)}`)
    return null
  }
}

async function findTaskByPulseId(pulseId: number) {
  return db.task.findFirst({
    where: {
      mondayItemId: String(pulseId),
    },
    include: {
      owners: true,
    },
  })
}

function shouldSkipEcho(task: { id: string; mondayLastSyncAt: Date | null }) {
  if (!task.mondayLastSyncAt) {
    return false
  }

  const elapsedMs = Date.now() - task.mondayLastSyncAt.getTime()
  if (elapsedMs >= 0 && elapsedMs < ECHO_DEBOUNCE_MS) {
    console.log(`[monday webhook] skipping echo for task ${task.id} (synced ${elapsedMs}ms ago)`)
    return true
  }

  return false
}

async function applyStatusChange(task: MondayTaskWithOwners, event: MondayEvent, actorEmail: string | null) {
  const newLabel = extractStatusLabel(event.value)
  if (!newLabel) {
    console.warn(`[monday webhook] status label missing for task ${task.id}`)
    return
  }

  const mappedStatus = STATUS_LABEL_TO_STATUS_MAP[newLabel]
  if (!mappedStatus) {
    console.warn(`[monday webhook] unknown status label "${newLabel}" for task ${task.id}`)
    return
  }

  if (mappedStatus === task.status) {
    return
  }

  const previousStatusLabel = extractStatusLabel(event.previousValue) ?? task.status

  const result = await db.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        status: mappedStatus,
        completedAt: isTerminalStatus(mappedStatus) ? new Date() : null,
      },
      include: {
        owners: true,
      },
    })

    const recurringTaskId = await maybeCreateNextRecurringTask(tx, {
      previousStatus: task.status,
      task: updatedTask,
    })

    await tx.taskNote.create({
      data: {
        taskId: task.id,
        authorId: null,
        source: "SYSTEM",
        body: `Status changed from ${previousStatusLabel} to ${mappedStatus} via Monday by ${formatActorEmail(actorEmail)}.`,
      },
    })

    return {
      recurringTaskId,
    }
  })

  if (result.recurringTaskId) {
    void syncTaskToMonday(result.recurringTaskId).catch((error) => {
      console.error(`[monday webhook] recurring sync failed ${result.recurringTaskId} ${toErrorMessage(error)}`)
    })
  }
}

async function applyTimelineChange(task: MondayTaskWithOwners, event: MondayEvent, actorEmail: string | null) {
  const nextRange = extractTimelineRange(event.value)
  if (nextRange === undefined) {
    console.warn(`[monday webhook] timeline value unrecognized for task ${task.id}`)
    return
  }

  const nextFrom = nextRange?.from ?? nextRange?.to ?? null
  const nextTo = nextRange?.to ?? nextRange?.from ?? null
  const nextFromDate = parseDateOnly(nextFrom)
  const nextToDate = parseDateOnly(nextTo)

  if ((nextFrom && !nextFromDate) || (nextTo && !nextToDate)) {
    console.warn(`[monday webhook] timeline date parse failed for task ${task.id}`)
    return
  }

  const previousDescription = describeTimelineRange(extractTimelineRange(event.previousValue))
  const nextDescription = describeTimelineRange(nextRange)

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        dueDateStart: nextFromDate,
        dueDateEnd: nextToDate,
      },
    })

    await tx.taskNote.create({
      data: {
        taskId: task.id,
        authorId: null,
        source: "SYSTEM",
        body: `Timeline changed from ${previousDescription} to ${nextDescription} via Monday by ${formatActorEmail(actorEmail)}.`,
      },
    })
  })
}

async function applyOwnerChange(task: MondayTaskWithOwners, event: MondayEvent, actorEmail: string | null) {
  const mondayOwnerIds = extractOwnerIds(event.value)
  if (!mondayOwnerIds) {
    console.warn(`[monday webhook] owner payload unrecognized for task ${task.id}`)
    return
  }

  const emailsByMondayId = new Map<number, string>()
  for (const mondayOwnerId of mondayOwnerIds) {
    const email = await resolveActorEmail(mondayOwnerId)
    if (!email) {
      console.warn(`[monday webhook] owner not mapped to email ${mondayOwnerId} (task ${task.id})`)
      continue
    }

    emailsByMondayId.set(mondayOwnerId, email)
  }

  const resolvedUsers =
    emailsByMondayId.size > 0
      ? await db.user_account.findMany({
          where: {
            email: {
              in: Array.from(new Set(Array.from(emailsByMondayId.values()))),
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : []

  const userIdByEmail = new Map(resolvedUsers.map((user) => [user.email.trim().toLowerCase(), user.id]))
  const resolvedOwnerUserIds = Array.from(
    new Set(
      Array.from(emailsByMondayId.values())
        .map((email) => userIdByEmail.get(email.trim().toLowerCase()) ?? null)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  )

  for (const email of emailsByMondayId.values()) {
    if (!userIdByEmail.has(email.trim().toLowerCase())) {
      console.warn(`[monday webhook] owner email not found in Concilio ${email} (task ${task.id})`)
    }
  }

  const previousOwnerUserIds = Array.from(new Set(task.owners.map((owner) => owner.userId)))
  const addedOwnerIds = resolvedOwnerUserIds.filter((id) => !previousOwnerUserIds.includes(id))
  const removedOwnerIds = previousOwnerUserIds.filter((id) => !resolvedOwnerUserIds.includes(id))

  await db.$transaction(async (tx) => {
    await tx.taskOwner.deleteMany({
      where: {
        taskId: task.id,
      },
    })

    if (resolvedOwnerUserIds.length > 0) {
      await tx.taskOwner.createMany({
        data: resolvedOwnerUserIds.map((userId) => ({
          taskId: task.id,
          userId,
        })),
      })
    }

    const impactedOwnerIds = Array.from(new Set([...addedOwnerIds, ...removedOwnerIds]))
    const impactedOwners =
      impactedOwnerIds.length > 0
        ? await tx.user_account.findMany({
            where: {
              id: {
                in: impactedOwnerIds,
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        : []

    const ownerLabelById = new Map(
      impactedOwners.map((owner) => [owner.id, owner.name?.trim() || owner.email]),
    )

    const addedLabels =
      addedOwnerIds.length > 0
        ? addedOwnerIds.map((ownerId) => ownerLabelById.get(ownerId) ?? ownerId).join(", ")
        : "none"
    const removedLabels =
      removedOwnerIds.length > 0
        ? removedOwnerIds.map((ownerId) => ownerLabelById.get(ownerId) ?? ownerId).join(", ")
        : "none"

    await tx.taskNote.create({
      data: {
        taskId: task.id,
        authorId: null,
        source: "SYSTEM",
        body: `Owners updated via Monday by ${formatActorEmail(actorEmail)}. Added: ${addedLabels}. Removed: ${removedLabels}.`,
      },
    })
  })
}

export async function handleColumnChange(event: MondayEvent): Promise<void> {
  try {
    const pulseId = toNumericId(event.pulseId)
    if (!pulseId) {
      console.warn("[monday webhook] missing pulseId for change_column_value")
      return
    }

    const task = await findTaskByPulseId(pulseId)
    if (!task) {
      console.log(`[monday webhook] task not found for pulse ${pulseId}`)
      return
    }

    if (shouldSkipEcho(task)) {
      return
    }

    const columnId = typeof event.columnId === "string" ? event.columnId : ""
    if (!columnId) {
      console.warn(`[monday webhook] missing columnId for pulse ${pulseId}`)
      return
    }

    const columnsById = await getBoardColumns()
    const columnTitle = columnsById[columnId]?.trim().toLowerCase()

    if (!columnTitle) {
      console.warn(`[monday webhook] unknown column id ${columnId} for pulse ${pulseId}`)
      return
    }

    const actorEmail = await resolveActorEmail(toNumericId(event.userId))

    if (columnTitle === MONDAY_TASK_COLUMN_TITLES.status) {
      await applyStatusChange(task, event, actorEmail)
      return
    }

    if (columnTitle === MONDAY_TASK_COLUMN_TITLES.timeline) {
      await applyTimelineChange(task, event, actorEmail)
      return
    }

    if (columnTitle === MONDAY_TASK_COLUMN_TITLES.owner) {
      await applyOwnerChange(task, event, actorEmail)
      return
    }
  } catch (error) {
    console.error(`[monday webhook] handleColumnChange ${toErrorMessage(error)}`)
  }
}

export async function handleItemDeleted(event: MondayEvent): Promise<void> {
  try {
    const pulseId = toNumericId(event.pulseId)
    if (!pulseId) {
      console.warn("[monday webhook] missing pulseId for delete_pulse")
      return
    }

    const task = await findTaskByPulseId(pulseId)
    if (!task) {
      console.log(`[monday webhook] task not found for deleted pulse ${pulseId}`)
      return
    }

    const mondayUserId = toNumericId(event.userId)
    const mondayUserEmail = await resolveActorEmail(mondayUserId)
    const deletedAt = new Date().toISOString()

    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: {
          id: task.id,
        },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          mondayItemId: null,
        },
      })

      await tx.taskNote.create({
        data: {
          taskId: task.id,
          authorId: null,
          source: "SYSTEM",
          body: `Task deleted in Monday by ${formatActorEmail(mondayUserEmail)}. Marked as cancelled in Concilio.`,
        },
      })

      if (!UUID_REGEX.test(task.id)) {
        console.error(
          `[monday webhook] audit_event skipped for task ${task.id}: audit_event.subject_id requires UUID; task ids are cuid strings`,
        )
        return
      }

      await tx.audit_event.create({
        data: {
          event_type: "monday_task_deleted",
          actor_type: "monday",
          actor_id: null,
          subject_type: "task",
          subject_id: task.id,
          details: {
            taskId: task.id,
            mondayUserId: mondayUserId ? String(mondayUserId) : null,
            mondayUserEmail,
            mondayPulseId: String(pulseId),
            deletedAt,
          },
        },
      })
    })
  } catch (error) {
    console.error(`[monday webhook] handleItemDeleted ${toErrorMessage(error)}`)
  }
}

export async function handleUpdateCreated(event: MondayEvent): Promise<void> {
  try {
    const pulseId = toNumericId(event.pulseId)
    if (!pulseId) {
      console.warn("[monday webhook] missing pulseId for create_update")
      return
    }

    const task = await db.task.findFirst({
      where: {
        mondayItemId: String(pulseId),
      },
      select: {
        id: true,
      },
    })

    if (!task) {
      console.log(`[monday webhook] task not found for update on pulse ${pulseId}`)
      return
    }

    const noteBodyRaw =
      typeof event.textBody === "string" && event.textBody.trim()
        ? event.textBody
        : typeof event.body === "string"
          ? stripHtml(event.body)
          : ""

    const noteBody = noteBodyRaw.trim()
    if (!noteBody) {
      return
    }

    const mondayUserId = toNumericId(event.userId)
    const mondayUserEmail = await resolveActorEmail(mondayUserId)
    const normalizedEmail = mondayUserEmail?.trim().toLowerCase() ?? null
    const author = normalizedEmail
      ? await db.user_account.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
          },
        })
      : null

    await db.taskNote.create({
      data: {
        taskId: task.id,
        authorId: author?.id ?? null,
        body: noteBody,
        source: "MONDAY",
        createdAt: parseCreatedAt(event.createdAt),
      },
    })
  } catch (error) {
    console.error(`[monday webhook] handleUpdateCreated ${toErrorMessage(error)}`)
  }
}
