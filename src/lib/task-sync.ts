import "server-only"

import type { Prisma, TaskStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { STATUS_MAP } from "@/lib/monday-mapping"
import {
  archiveMondayItem,
  createMondayItem,
  getMondayUserIdByEmail,
  resolveMondayClientItemId,
  updateMondayItem,
} from "@/lib/monday"

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    owners: true
  }
}>

type Client =
  | Prisma.client_classificationGetPayload<{
      select: {
        party: {
          select: {
            display_name: true
          }
        }
      }
    }>
  | null

const MONDAY_COLUMN_TITLES = {
  clientName: "Client Name",
  owner: "Owner",
  taskCategory: "Task Category",
  status: "Status",
  timeline: "Timeline",
} as const

function toDateOnlyString(value: Date | null) {
  if (!value) {
    return null
  }

  return value.toISOString().slice(0, 10)
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

function isLikelyTaskCategoryMismatchError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase()
  return (
    normalized.includes("dropdown") ||
    normalized.includes("label") ||
    normalized.includes("task category") ||
    normalized.includes("column value")
  )
}

async function resolveMondayOwnerIds(task: TaskWithRelations) {
  if (task.owners.length === 0) {
    return []
  }

  const ownerUserIds = Array.from(new Set(task.owners.map((owner) => owner.userId)))
  const ownerAccounts = await db.user_account.findMany({
    where: {
      id: {
        in: ownerUserIds,
      },
    },
    select: {
      id: true,
      email: true,
    },
  })

  const ownerEmailByUserId = new Map(ownerAccounts.map((owner) => [owner.id, owner.email]))
  const mondayOwnerIds: number[] = []

  for (const owner of task.owners) {
    const email = ownerEmailByUserId.get(owner.userId)
    if (!email) {
      console.warn(`[monday sync warning] ${task.id} owner-email-missing ${owner.userId}`)
      continue
    }

    try {
      const mondayUserId = await getMondayUserIdByEmail(email)
      if (!mondayUserId) {
        console.warn(`[monday sync warning] ${task.id} owner-not-found ${email}`)
        continue
      }

      if (!mondayOwnerIds.includes(mondayUserId)) {
        mondayOwnerIds.push(mondayUserId)
      }
    } catch (error) {
      console.warn(`[monday sync warning] ${task.id} owner-lookup-failed ${toErrorMessage(error)}`)
    }
  }

  return mondayOwnerIds
}

export async function buildMondayPayload(task: TaskWithRelations, client: Client): Promise<{
  itemName: string
  columnValues: Record<string, unknown>
}> {
  const mondayOwnerIds = await resolveMondayOwnerIds(task)
  const clientDisplayName = client?.party?.display_name ?? ""
  const clientItemId = await resolveMondayClientItemId(clientDisplayName)

  const statusLabel = STATUS_MAP[task.status as TaskStatus] ?? STATUS_MAP.NOT_STARTED
  const dueDateStart = toDateOnlyString(task.dueDateStart)
  const dueDateEnd = toDateOnlyString(task.dueDateEnd)
  const resolvedTimelineEnd = dueDateEnd ?? dueDateStart

  const columnValues: Record<string, unknown> = {}

  if (task.type.trim()) {
    columnValues[MONDAY_COLUMN_TITLES.taskCategory] = {
      label: task.type.trim(),
    }
  }

  columnValues[MONDAY_COLUMN_TITLES.status] = { label: statusLabel }

  if (clientItemId) {
    const numericClientItemId = Number(clientItemId)
    if (Number.isInteger(numericClientItemId) && numericClientItemId > 0) {
      columnValues[MONDAY_COLUMN_TITLES.clientName] = { item_ids: [numericClientItemId] }
    }
  } else {
    console.warn(
      `[monday sync] client not found on client board: "${clientDisplayName}" (task ${task.id})`,
    )
  }

  if (mondayOwnerIds.length > 0) {
    columnValues[MONDAY_COLUMN_TITLES.owner] = {
      personsAndTeams: mondayOwnerIds.map((ownerId) => ({
        id: ownerId,
        kind: "person",
      })),
    }
  }

  if (dueDateStart && resolvedTimelineEnd) {
    columnValues[MONDAY_COLUMN_TITLES.timeline] = {
      from: dueDateStart,
      to: resolvedTimelineEnd,
    }
  }

  return {
    itemName: task.title,
    columnValues,
  }
}

async function pushCreateOrUpdateToMonday(params: {
  taskId: string
  existingMondayItemId: string | null
  itemName: string
  columnValues: Record<string, unknown>
}) {
  const taskCategoryKey = MONDAY_COLUMN_TITLES.taskCategory

  try {
    if (params.existingMondayItemId) {
      await updateMondayItem({
        itemId: params.existingMondayItemId,
        columnValues: params.columnValues,
      })

      return {
        mondayItemId: params.existingMondayItemId,
      }
    }

    const createdItemId = await createMondayItem({
      itemName: params.itemName,
      columnValues: params.columnValues,
    })

    return {
      mondayItemId: createdItemId,
    }
  } catch (error) {
    const errorMessage = toErrorMessage(error)
    const hasTaskCategory = Object.prototype.hasOwnProperty.call(params.columnValues, taskCategoryKey)

    if (!hasTaskCategory || !isLikelyTaskCategoryMismatchError(errorMessage)) {
      throw error
    }

    console.warn(
      `[monday sync warning] ${params.taskId} task-category-skipped ${errorMessage}`,
    )

    const columnValuesWithoutTaskCategory = Object.fromEntries(
      Object.entries(params.columnValues).filter(([columnTitle]) => columnTitle !== taskCategoryKey),
    )

    if (params.existingMondayItemId) {
      await updateMondayItem({
        itemId: params.existingMondayItemId,
        columnValues: columnValuesWithoutTaskCategory,
      })

      return {
        mondayItemId: params.existingMondayItemId,
      }
    }

    const createdItemId = await createMondayItem({
      itemName: params.itemName,
      columnValues: columnValuesWithoutTaskCategory,
    })

    return {
      mondayItemId: createdItemId,
    }
  }
}

export async function syncTaskToMonday(taskId: string): Promise<void> {
  let operation = "load-task"

  try {
    const task = await db.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        owners: true,
      },
    })

    if (!task) {
      return
    }

    if (task.status === "CANCELLED") {
      if (!task.mondayItemId) {
        return
      }

      operation = "archive"
      await archiveMondayItem(task.mondayItemId)
      await db.task.update({
        where: {
          id: task.id,
        },
        data: {
          mondayItemId: null,
          mondayLastSyncAt: new Date(),
        },
      })

      return
    }

    const client = await db.client_classification.findUnique({
      where: {
        party_id: task.clientId,
      },
      select: {
        party: {
          select: {
            display_name: true,
          },
        },
      },
    })

    const payload = await buildMondayPayload(task, client)
    operation = task.mondayItemId ? "update" : "create"
    const pushed = await pushCreateOrUpdateToMonday({
      taskId: task.id,
      existingMondayItemId: task.mondayItemId,
      itemName: payload.itemName,
      columnValues: payload.columnValues,
    })

    await db.task.update({
      where: {
        id: task.id,
      },
      data: {
        mondayItemId: pushed.mondayItemId,
        mondayLastSyncAt: new Date(),
      },
    })
  } catch (error) {
    console.error(`[monday sync failed] ${taskId} ${operation} ${toErrorMessage(error)}`)
  }
}
