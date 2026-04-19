import { NextResponse } from "next/server"
import type { RecurrenceCadence, TaskStatus } from "@prisma/client"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { syncTaskToMonday } from "@/lib/task-sync"
import {
  isLiveSeriesStatus,
  isRecurrenceCadence,
  isTaskStatus,
  parseDocumentLinks,
  parseOwnerIds,
  toNullableBoolean,
  toNullableDate,
  toNullablePositiveInt,
  toNullableTrimmedString,
  toRequiredTrimmedString,
  type NormalizedDocumentLinkInput,
} from "@/lib/task-enrichment"

const LIVE_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS"]
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function parseRecurrenceFields(payload: Record<string, unknown>) {
  const isRecurringRaw = toNullableBoolean(payload.isRecurring)
  if (isRecurringRaw === undefined) {
    return { error: "isRecurring must be a boolean" } as const
  }

  const cadenceRaw = toNullableTrimmedString(payload.recurrenceCadence)
  if (cadenceRaw === undefined) {
    return { error: "recurrenceCadence must be a string or null" } as const
  }

  const recurrenceCadence = cadenceRaw
  if (recurrenceCadence && !isRecurrenceCadence(recurrenceCadence)) {
    return { error: "invalid recurrenceCadence" } as const
  }

  const recurrenceEndDate = toNullableDate(payload.recurrenceEndDate)
  if (recurrenceEndDate === undefined) {
    return { error: "recurrenceEndDate must be a valid date or null" } as const
  }

  const recurrenceCount = toNullablePositiveInt(payload.recurrenceCount)
  if (recurrenceCount === undefined) {
    return { error: "recurrenceCount must be a positive integer or null" } as const
  }

  if (recurrenceEndDate && recurrenceCount) {
    return { error: "Choose either recurrenceEndDate or recurrenceCount, not both" } as const
  }

  const parentTaskIdRaw = toNullableTrimmedString(payload.parentTaskId)
  if (parentTaskIdRaw === undefined) {
    return { error: "parentTaskId must be a string or null" } as const
  }

  const isRecurring = isRecurringRaw ?? false

  if (!isRecurring) {
    return {
      isRecurring: false,
      recurrenceCadence: null,
      recurrenceEndDate: null,
      recurrenceCount: null,
      parentTaskId: null,
    } as const
  }

  if (!recurrenceCadence) {
    return { error: "recurrenceCadence is required when isRecurring is true" } as const
  }

  return {
    isRecurring,
    recurrenceCadence,
    recurrenceEndDate,
    recurrenceCount,
    parentTaskId: parentTaskIdRaw,
  } as const
}

function parseOwnersFromPayload(payload: Record<string, unknown>) {
  if (Object.prototype.hasOwnProperty.call(payload, "owners")) {
    return parseOwnerIds(payload.owners)
  }

  const ownerUserId = toNullableTrimmedString(payload.ownerUserId)
  if (ownerUserId === undefined) {
    return { ok: false as const, error: "ownerUserId must be a string or null" }
  }

  return {
    ok: true as const,
    value: ownerUserId ? [ownerUserId] : [],
  }
}

function parseDocumentLinksFromPayload(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, "documentLinks")) {
    return {
      ok: true as const,
      value: [] as NormalizedDocumentLinkInput[],
    }
  }

  return parseDocumentLinks(payload.documentLinks)
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("clientId")?.trim() ?? ""
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }

  try {
    const tasks = await db.task.findMany({
      where: {
        clientId,
      },
      include: taskInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    const ownerMap = await buildOwnerMap(
      uniqueStrings(tasks.flatMap((task) => task.owners.map((owner) => owner.userId))),
    )

    return NextResponse.json({
      tasks: tasks.map((task) => serializeTask(task, ownerMap)),
    })
 } catch (error) {
    console.error("[tasks list error]", error)
    return NextResponse.json({ error: "failed to load tasks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const clientId = toRequiredTrimmedString(payload.clientId)
  const title = toRequiredTrimmedString(payload.title)
  const type = toRequiredTrimmedString(payload.type)
  const subtype = toNullableTrimmedString(payload.subtype)
  const description = typeof payload.description === "string" ? payload.description : null
  const dueDateStart = toNullableDate(payload.dueDateStart)
  const dueDateEnd = toNullableDate(payload.dueDateEnd)
  const statusRaw = toNullableTrimmedString(payload.status) ?? "NOT_STARTED"

  if (!clientId || !title || !type) {
    return NextResponse.json({ error: "clientId, title and type are required" }, { status: 400 })
  }

  if (subtype === undefined) {
    return NextResponse.json({ error: "subtype must be a string or null" }, { status: 400 })
  }

  if (dueDateStart === undefined || dueDateEnd === undefined) {
    return NextResponse.json({ error: "invalid due date value" }, { status: 400 })
  }

  if (dueDateEnd && !dueDateStart) {
    return NextResponse.json({ error: "dueDateStart is required when dueDateEnd is set" }, { status: 400 })
  }

  if (!isTaskStatus(statusRaw)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 })
  }

  const ownersParsed = parseOwnersFromPayload(payload)
  if (!ownersParsed.ok) {
    return NextResponse.json({ error: ownersParsed.error }, { status: 400 })
  }

  const ownerIds = uniqueStrings(ownersParsed.value)
  const ownersValid = await validateOwnerIds(ownerIds)
  if (!ownersValid) {
    return NextResponse.json({ error: "owners contain invalid users" }, { status: 400 })
  }

  const recurrenceParsed = parseRecurrenceFields(payload)
  if ("error" in recurrenceParsed) {
    return NextResponse.json({ error: recurrenceParsed.error }, { status: 400 })
  }

  if (recurrenceParsed.isRecurring && !dueDateStart) {
    return NextResponse.json(
      { error: "Recurring tasks require dueDateStart so the next instance can be scheduled" },
      { status: 400 },
    )
  }

  const documentLinksParsed = parseDocumentLinksFromPayload(payload)
  if (!documentLinksParsed.ok) {
    return NextResponse.json({ error: documentLinksParsed.error }, { status: 400 })
  }

  const parentTaskId = recurrenceParsed.parentTaskId

  try {
    if (recurrenceParsed.isRecurring && isLiveSeriesStatus(statusRaw)) {
      if (parentTaskId) {
        const existingLive = await db.task.findFirst({
          where: {
            parentTaskId,
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
      } else {
        const existingLive = await db.task.findFirst({
          where: {
            clientId,
            title,
            type,
            subtype,
            isRecurring: true,
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
              error: "A live recurring task already exists. Complete it before creating another.",
              code: "DUPLICATE_LIVE_RECURRING",
            },
            { status: 409 },
          )
        }
      }
    }

    const task = await db.$transaction(async (tx) => {
      if (parentTaskId) {
        const parentTask = await tx.task.findUnique({
          where: { id: parentTaskId },
          select: { id: true },
        })

        if (!parentTask) {
          throw new Error("parent-task-not-found")
        }
      }

      const created = await tx.task.create({
        data: {
          clientId,
          title,
          description,
          type,
          subtype,
          status: statusRaw,
          dueDateStart,
          dueDateEnd,
          completedAt: statusRaw === "DONE" || statusRaw === "CANCELLED" ? new Date() : null,
          isRecurring: recurrenceParsed.isRecurring,
          recurrenceCadence: recurrenceParsed.recurrenceCadence as RecurrenceCadence | null,
          recurrenceEndDate: recurrenceParsed.recurrenceEndDate,
          recurrenceCount: recurrenceParsed.recurrenceCount,
          parentTaskId: parentTaskId,
          owners:
            ownerIds.length > 0
              ? {
                  create: ownerIds.map((userId) => ({ userId })),
                }
              : undefined,
          documentLinks:
            documentLinksParsed.value.length > 0
              ? {
                  create: documentLinksParsed.value,
                }
              : undefined,
        },
        include: taskInclude,
      })

      if (recurrenceParsed.isRecurring && !parentTaskId) {
        return tx.task.update({
          where: {
            id: created.id,
          },
          data: {
            parentTaskId: created.id,
          },
          include: taskInclude,
        })
      }

      return created
    })

    const ownerMap = await buildOwnerMap(uniqueStrings(task.owners.map((owner) => owner.userId)))
    const response = NextResponse.json({ task: serializeTask(task, ownerMap) }, { status: 201 })
    void syncTaskToMonday(task.id)
    return response
  } catch (error) {
    if (error instanceof Error && error.message === "parent-task-not-found") {
      return NextResponse.json({ error: "parentTaskId not found" }, { status: 400 })
    }

    console.error("[task create error]", error)
    return NextResponse.json({ error: "failed to create task" }, { status: 500 })
  }
}
