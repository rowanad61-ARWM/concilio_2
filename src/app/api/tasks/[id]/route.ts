import { NextResponse } from "next/server"
import type { TaskStatus } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { archiveMondayItem } from "@/lib/monday"
import { syncTaskToMonday } from "@/lib/task-sync"
import {
  isLiveSeriesStatus,
  isRecurrenceCadence,
  isTaskStatus,
  maybeCreateNextRecurringTask,
  parseDocumentLinks,
  parseOwnerIds,
  toNullableBoolean,
  toNullableDate,
  toNullablePositiveInt,
  toNullableTrimmedString,
  type NormalizedDocumentLinkInput,
} from "@/lib/task-enrichment"

const LIVE_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS"]
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type OwnerSummary = {
  id: string
  fullName: string
  email: string
}

const taskInclude = {
  owners: true,
  documentLinks: {
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  _count: {
    select: {
      notes: true,
    },
  },
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}

function isUuid(value: string) {
  return UUID_REGEX.test(value)
}

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  )
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

async function buildOwnerMap(ownerUserIds: string[]) {
  if (ownerUserIds.length === 0) {
    return new Map<string, OwnerSummary>()
  }

  const owners = await db.user_account.findMany({
    where: {
      id: {
        in: ownerUserIds,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  return new Map(
    owners.map((owner) => [
      owner.id,
      {
        id: owner.id,
        fullName: owner.name,
        email: owner.email,
      },
    ]),
  )
}

async function validateOwnerIds(ownerIds: string[]) {
  if (ownerIds.length === 0) {
    return true
  }

  if (ownerIds.some((ownerId) => !isUuid(ownerId))) {
    return false
  }

  const count = await db.user_account.count({
    where: {
      id: {
        in: ownerIds,
      },
    },
  })

  return count === ownerIds.length
}

function serializeTask(
  task: {
    id: string
    clientId: string
    title: string
    description: string | null
    type: string
    subtype: string | null
    status: string
    dueDateStart: Date | null
    dueDateEnd: Date | null
    completedAt: Date | null
    isRecurring: boolean
    recurrenceCadence: string | null
    recurrenceEndDate: Date | null
    recurrenceCount: number | null
    parentTaskId: string | null
    createdAt: Date
    updatedAt: Date
    owners: {
      id: string
      userId: string
    }[]
    documentLinks: {
      id: string
      sharepointDriveItemId: string
      fileName: string
      folder: string
      createdAt: Date
    }[]
    _count: {
      notes: number
    }
  },
  ownerMap: Map<string, OwnerSummary>,
) {
  const owners = task.owners
    .map((owner) => ownerMap.get(owner.userId) ?? null)
    .filter((owner): owner is OwnerSummary => Boolean(owner))

  return {
    id: task.id,
    clientId: task.clientId,
    title: task.title,
    description: task.description,
    type: task.type,
    subtype: task.subtype,
    status: task.status,
    ownerUserId: owners[0]?.id ?? null,
    owner: owners[0] ?? null,
    owners,
    dueDateStart: task.dueDateStart ? task.dueDateStart.toISOString() : null,
    dueDateEnd: task.dueDateEnd ? task.dueDateEnd.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    isRecurring: task.isRecurring,
    recurrenceCadence: task.recurrenceCadence,
    recurrenceEndDate: task.recurrenceEndDate ? task.recurrenceEndDate.toISOString() : null,
    recurrenceCount: task.recurrenceCount,
    parentTaskId: task.parentTaskId,
    documentLinks: task.documentLinks.map((link) => ({
      id: link.id,
      sharepointDriveItemId: link.sharepointDriveItemId,
      fileName: link.fileName,
      folder: link.folder,
      createdAt: link.createdAt.toISOString(),
    })),
    linkedDocumentCount: task.documentLinks.length,
    noteCount: task._count.notes,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const task = await db.task.findUnique({
      where: { id },
      include: taskInclude,
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const ownerMap = await buildOwnerMap(uniqueStrings(task.owners.map((owner) => owner.userId)))
    return NextResponse.json({ task: serializeTask(task, ownerMap) })
  } catch (error) {
    console.error("[task fetch error]", error)
    return NextResponse.json({ error: "failed to load task" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const currentTask = await db.task.findUnique({
    where: { id },
    include: taskInclude,
  })

  if (!currentTask) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = toNullableTrimmedString(payload.title)
    if (title === undefined || title === null) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 })
    }

    data.title = title
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    if (payload.description !== null && typeof payload.description !== "string") {
      return NextResponse.json({ error: "description must be a string or null" }, { status: 400 })
    }

    data.description = payload.description as string | null
  }

  if (Object.prototype.hasOwnProperty.call(payload, "type")) {
    const type = toNullableTrimmedString(payload.type)
    if (type === undefined || type === null) {
      return NextResponse.json({ error: "type must be a non-empty string" }, { status: 400 })
    }

    data.type = type
  }

  if (Object.prototype.hasOwnProperty.call(payload, "subtype")) {
    const subtype = toNullableTrimmedString(payload.subtype)
    if (subtype === undefined) {
      return NextResponse.json({ error: "subtype must be a string or null" }, { status: 400 })
    }

    data.subtype = subtype
  }

  if (Object.prototype.hasOwnProperty.call(payload, "clientId")) {
    const clientId = toNullableTrimmedString(payload.clientId)
    if (clientId === undefined || clientId === null) {
      return NextResponse.json({ error: "clientId must be a non-empty string" }, { status: 400 })
    }

    data.clientId = clientId
  }

  let effectiveDueDateStart = currentTask.dueDateStart
  let effectiveDueDateEnd = currentTask.dueDateEnd

  if (
    Object.prototype.hasOwnProperty.call(payload, "dueDateStart") ||
    Object.prototype.hasOwnProperty.call(payload, "dueDateEnd")
  ) {
    const dueDateStart = Object.prototype.hasOwnProperty.call(payload, "dueDateStart")
      ? toNullableDate(payload.dueDateStart)
      : currentTask.dueDateStart
    const dueDateEnd = Object.prototype.hasOwnProperty.call(payload, "dueDateEnd")
      ? toNullableDate(payload.dueDateEnd)
      : currentTask.dueDateEnd

    if (dueDateStart === undefined || dueDateEnd === undefined) {
      return NextResponse.json({ error: "invalid due date value" }, { status: 400 })
    }

    if (dueDateEnd && !dueDateStart) {
      return NextResponse.json({ error: "dueDateStart is required when dueDateEnd is set" }, { status: 400 })
    }

    effectiveDueDateStart = dueDateStart
    effectiveDueDateEnd = dueDateEnd

    if (Object.prototype.hasOwnProperty.call(payload, "dueDateStart")) {
      data.dueDateStart = dueDateStart
    }

    if (Object.prototype.hasOwnProperty.call(payload, "dueDateEnd")) {
      data.dueDateEnd = dueDateEnd
    }
  }

  let effectiveStatus = currentTask.status

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = toNullableTrimmedString(payload.status)
    if (status === undefined || status === null || !isTaskStatus(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    effectiveStatus = status
    data.status = status

    if (status === "DONE" || status === "CANCELLED") {
      data.completedAt = currentTask.completedAt ?? new Date()
    } else {
      data.completedAt = null
    }
  } else if (Object.prototype.hasOwnProperty.call(payload, "completedAt")) {
    const completedAt = toNullableDate(payload.completedAt)
    if (completedAt === undefined) {
      return NextResponse.json({ error: "invalid completedAt value" }, { status: 400 })
    }

    data.completedAt = completedAt
  }

  let ownerIds: string[] | null = null

  if (Object.prototype.hasOwnProperty.call(payload, "owners")) {
    const parsed = parseOwnerIds(payload.owners)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    ownerIds = uniqueStrings(parsed.value)
  } else if (Object.prototype.hasOwnProperty.call(payload, "ownerUserId")) {
    const ownerUserId = toNullableTrimmedString(payload.ownerUserId)
    if (ownerUserId === undefined) {
      return NextResponse.json({ error: "ownerUserId must be a string or null" }, { status: 400 })
    }

    ownerIds = ownerUserId ? [ownerUserId] : []
  }

  if (ownerIds) {
    const ownersValid = await validateOwnerIds(ownerIds)
    if (!ownersValid) {
      return NextResponse.json({ error: "owners contain invalid users" }, { status: 400 })
    }
  }

  let documentLinks: NormalizedDocumentLinkInput[] | null = null

  if (Object.prototype.hasOwnProperty.call(payload, "documentLinks")) {
    const parsed = parseDocumentLinks(payload.documentLinks)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    documentLinks = parsed.value
  }

  const isRecurringRaw = Object.prototype.hasOwnProperty.call(payload, "isRecurring")
    ? toNullableBoolean(payload.isRecurring)
    : null

  if (isRecurringRaw === undefined) {
    return NextResponse.json({ error: "isRecurring must be a boolean" }, { status: 400 })
  }

  const recurrenceCadenceRaw = Object.prototype.hasOwnProperty.call(payload, "recurrenceCadence")
    ? toNullableTrimmedString(payload.recurrenceCadence)
    : currentTask.recurrenceCadence

  if (recurrenceCadenceRaw === undefined) {
    return NextResponse.json({ error: "recurrenceCadence must be a string or null" }, { status: 400 })
  }

  if (recurrenceCadenceRaw && !isRecurrenceCadence(recurrenceCadenceRaw)) {
    return NextResponse.json({ error: "invalid recurrenceCadence" }, { status: 400 })
  }

  const recurrenceEndDateRaw = Object.prototype.hasOwnProperty.call(payload, "recurrenceEndDate")
    ? toNullableDate(payload.recurrenceEndDate)
    : currentTask.recurrenceEndDate

  if (recurrenceEndDateRaw === undefined) {
    return NextResponse.json({ error: "recurrenceEndDate must be a valid date or null" }, { status: 400 })
  }

  const recurrenceCountRaw = Object.prototype.hasOwnProperty.call(payload, "recurrenceCount")
    ? toNullablePositiveInt(payload.recurrenceCount)
    : currentTask.recurrenceCount

  if (recurrenceCountRaw === undefined) {
    return NextResponse.json({ error: "recurrenceCount must be a positive integer or null" }, { status: 400 })
  }

  if (recurrenceEndDateRaw && recurrenceCountRaw) {
    return NextResponse.json({ error: "Choose either recurrenceEndDate or recurrenceCount, not both" }, { status: 400 })
  }

  const parentTaskIdRaw = Object.prototype.hasOwnProperty.call(payload, "parentTaskId")
    ? toNullableTrimmedString(payload.parentTaskId)
    : currentTask.parentTaskId

  if (parentTaskIdRaw === undefined) {
    return NextResponse.json({ error: "parentTaskId must be a string or null" }, { status: 400 })
  }

  const effectiveIsRecurring = isRecurringRaw ?? currentTask.isRecurring

  const effectiveRecurrenceCadence = effectiveIsRecurring ? recurrenceCadenceRaw : null
  const effectiveRecurrenceEndDate = effectiveIsRecurring ? recurrenceEndDateRaw : null
  const effectiveRecurrenceCount = effectiveIsRecurring ? recurrenceCountRaw : null
  const effectiveParentTaskId = effectiveIsRecurring ? parentTaskIdRaw : null

  if (effectiveIsRecurring && !effectiveRecurrenceCadence) {
    return NextResponse.json({ error: "recurrenceCadence is required for recurring tasks" }, { status: 400 })
  }

  if (effectiveIsRecurring && !effectiveDueDateStart) {
    return NextResponse.json(
      { error: "Recurring tasks require dueDateStart so the next instance can be scheduled" },
      { status: 400 },
    )
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isRecurring")) {
    data.isRecurring = effectiveIsRecurring
  }

  if (Object.prototype.hasOwnProperty.call(payload, "recurrenceCadence") || Object.prototype.hasOwnProperty.call(payload, "isRecurring")) {
    data.recurrenceCadence = effectiveRecurrenceCadence
  }

  if (Object.prototype.hasOwnProperty.call(payload, "recurrenceEndDate") || Object.prototype.hasOwnProperty.call(payload, "isRecurring")) {
    data.recurrenceEndDate = effectiveRecurrenceEndDate
  }

  if (Object.prototype.hasOwnProperty.call(payload, "recurrenceCount") || Object.prototype.hasOwnProperty.call(payload, "isRecurring")) {
    data.recurrenceCount = effectiveRecurrenceCount
  }

  if (Object.prototype.hasOwnProperty.call(payload, "parentTaskId") || Object.prototype.hasOwnProperty.call(payload, "isRecurring")) {
    data.parentTaskId = effectiveParentTaskId
  }

  if (effectiveIsRecurring && isLiveSeriesStatus(effectiveStatus)) {
    const recurrenceRootId = effectiveParentTaskId ?? currentTask.parentTaskId ?? currentTask.id

    const existingLive = await db.task.findFirst({
      where: {
        id: {
          not: id,
        },
        OR: [{ id: recurrenceRootId }, { parentTaskId: recurrenceRootId }],
        status: {
          in: LIVE_STATUSES,
        },
      },
      select: {
        id: true,
      },
    })

    if (existingLive) {
      return NextResponse.json(
        {
          error: "A live task already exists for this recurring series. Complete it before creating another.",
          code: "DUPLICATE_LIVE_RECURRING",
        },
        { status: 409 },
      )
    }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      if (effectiveParentTaskId) {
        const parentTask = await tx.task.findUnique({
          where: { id: effectiveParentTaskId },
          select: { id: true },
        })

        if (!parentTask) {
          throw new Error("parent-task-not-found")
        }
      }

      let updatedTask = await tx.task.update({
        where: { id },
        data: {
          ...(data as Record<string, unknown>),
          owners:
            ownerIds !== null
              ? {
                  deleteMany: {},
                  create: ownerIds.map((userId) => ({ userId })),
                }
              : undefined,
          documentLinks:
            documentLinks !== null
              ? {
                  deleteMany: {},
                  create: documentLinks,
                }
              : undefined,
        },
        include: taskInclude,
      })
      let recurringTaskId: string | null = null

      if (updatedTask.isRecurring && !updatedTask.parentTaskId) {
        updatedTask = await tx.task.update({
          where: {
            id: updatedTask.id,
          },
          data: {
            parentTaskId: updatedTask.id,
          },
          include: taskInclude,
        })
      }

      recurringTaskId = await maybeCreateNextRecurringTask(tx, {
        previousStatus: currentTask.status,
        task: updatedTask,
      })

      return {
        updatedTask,
        recurringTaskId,
      }
    })
    const task = result.updatedTask

    const ownerMap = await buildOwnerMap(uniqueStrings(task.owners.map((owner) => owner.userId)))
    const response = NextResponse.json({ task: serializeTask(task, ownerMap) })
    void syncTaskToMonday(task.id)
    if (result.recurringTaskId) {
      void syncTaskToMonday(result.recurringTaskId)
    }
    return response
  } catch (error) {
    if (error instanceof Error && error.message === "parent-task-not-found") {
      return NextResponse.json({ error: "parentTaskId not found" }, { status: 400 })
    }

    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    console.error("[task update error]", error)
    return NextResponse.json({ error: "failed to update task" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existingTask = await db.task.findUnique({
      where: { id },
      select: {
        mondayItemId: true,
      },
    })

    await db.task.delete({
      where: { id },
    })

    if (existingTask?.mondayItemId) {
      const mondayItemId = existingTask.mondayItemId
      void archiveMondayItem(mondayItemId).catch((error) => {
        console.error(`[monday sync failed] ${id} archive-delete ${toErrorMessage(error)}`)
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    console.error("[task delete error]", error)
    return NextResponse.json({ error: "failed to delete task" }, { status: 500 })
  }
}
