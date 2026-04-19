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
  if (typeof value !== "string") {
    return null
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
      orderBy: {
        createdAt: "desc",
      },
    })

    const ownerMap = await buildOwnerMap(
      Array.from(
        new Set(
          tasks
            .map((task) => task.ownerUserId)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      ),
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

  const clientId = toNullableTrimmedString(payload.clientId)
  const title = toNullableTrimmedString(payload.title)
  const type = toNullableTrimmedString(payload.type)
  const subtype = toNullableTrimmedString(payload.subtype)
  const description = typeof payload.description === "string" ? payload.description : null
  const ownerUserId = toNullableTrimmedString(payload.ownerUserId)
  const dueDateStart = toNullableDate(payload.dueDateStart)
  const dueDateEnd = toNullableDate(payload.dueDateEnd)
  const statusRaw = toNullableTrimmedString(payload.status) ?? "NOT_STARTED"

  if (!clientId || !title || !type) {
    return NextResponse.json({ error: "clientId, title and type are required" }, { status: 400 })
  }

  if (!isTaskStatus(statusRaw)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 })
  }

  if (dueDateStart === undefined || dueDateEnd === undefined) {
    return NextResponse.json({ error: "invalid due date value" }, { status: 400 })
  }

  if (dueDateEnd && !dueDateStart) {
    return NextResponse.json({ error: "dueDateStart is required when dueDateEnd is set" }, { status: 400 })
  }

  try {
    const task = await db.task.create({
      data: {
        clientId,
        title,
        description,
        type,
        subtype,
        status: statusRaw,
        ownerUserId,
        dueDateStart,
        dueDateEnd,
        completedAt: statusRaw === "DONE" ? new Date() : null,
      },
    })

    const ownerMap = await buildOwnerMap(task.ownerUserId ? [task.ownerUserId] : [])
    return NextResponse.json({ task: serializeTask(task, ownerMap) }, { status: 201 })
  } catch (error) {
    console.error("[task create error]", error)
    return NextResponse.json({ error: "failed to create task" }, { status: 500 })
  }
}
