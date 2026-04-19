import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"

const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_EXTERNAL",
  "WAITING_INTERNAL",
  "NEEDS_REVIEW",
  "WITH_CLIENT",
  "STUCK",
  "ON_HOLD",
  "DONE",
] as const

type TaskStatusValue = (typeof TASK_STATUSES)[number]

function isTaskStatus(value: string): value is TaskStatusValue {
  return TASK_STATUSES.includes(value as TaskStatusValue)
}

function toNullableTrimmedString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || null
}

function toNullableDate(value: unknown) {
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

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  )
}

async function buildOwnerMap(ownerUserIds: string[]) {
  if (ownerUserIds.length === 0) {
    return new Map<string, { id: string; fullName: string; email: string }>()
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
    ownerUserId: string | null
    dueDateStart: Date | null
    dueDateEnd: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  },
  ownerMap: Map<string, { id: string; fullName: string; email: string }>,
) {
  return {
    ...task,
    dueDateStart: task.dueDateStart ? task.dueDateStart.toISOString() : null,
    dueDateEnd: task.dueDateEnd ? task.dueDateEnd.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    owner: task.ownerUserId ? ownerMap.get(task.ownerUserId) ?? null : null,
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
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const ownerMap = await buildOwnerMap(task.ownerUserId ? [task.ownerUserId] : [])
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

  if (Object.prototype.hasOwnProperty.call(payload, "ownerUserId")) {
    const ownerUserId = toNullableTrimmedString(payload.ownerUserId)
    if (ownerUserId === undefined) {
      return NextResponse.json({ error: "ownerUserId must be a string or null" }, { status: 400 })
    }
    data.ownerUserId = ownerUserId
  }

  if (Object.prototype.hasOwnProperty.call(payload, "clientId")) {
    const clientId = toNullableTrimmedString(payload.clientId)
    if (clientId === undefined || clientId === null) {
      return NextResponse.json({ error: "clientId must be a non-empty string" }, { status: 400 })
    }
    data.clientId = clientId
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "dueDateStart") ||
    Object.prototype.hasOwnProperty.call(payload, "dueDateEnd")
  ) {
    const dueDateStart = Object.prototype.hasOwnProperty.call(payload, "dueDateStart")
      ? toNullableDate(payload.dueDateStart)
      : undefined
    const dueDateEnd = Object.prototype.hasOwnProperty.call(payload, "dueDateEnd")
      ? toNullableDate(payload.dueDateEnd)
      : undefined

    if (dueDateStart === undefined || dueDateEnd === undefined) {
      return NextResponse.json({ error: "invalid due date value" }, { status: 400 })
    }

    if ((dueDateEnd ?? null) && (dueDateStart ?? null) === null) {
      return NextResponse.json({ error: "dueDateStart is required when dueDateEnd is set" }, { status: 400 })
    }

    if (dueDateStart !== undefined) {
      data.dueDateStart = dueDateStart
    }

    if (dueDateEnd !== undefined) {
      data.dueDateEnd = dueDateEnd
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = toNullableTrimmedString(payload.status)
    if (status === undefined || status === null || !isTaskStatus(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }

    data.status = status
    data.completedAt = status === "DONE" ? new Date() : null
  } else if (Object.prototype.hasOwnProperty.call(payload, "completedAt")) {
    const completedAt = toNullableDate(payload.completedAt)
    if (completedAt === undefined) {
      return NextResponse.json({ error: "invalid completedAt value" }, { status: 400 })
    }
    data.completedAt = completedAt
  }

  try {
    const task = await db.task.update({
      where: { id },
      data: data as never,
    })

    const ownerMap = await buildOwnerMap(task.ownerUserId ? [task.ownerUserId] : [])
    return NextResponse.json({ task: serializeTask(task, ownerMap) })
  } catch (error) {
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
    await db.task.delete({
      where: { id },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    console.error("[task delete error]", error)
    return NextResponse.json({ error: "failed to delete task" }, { status: 500 })
  }
}
