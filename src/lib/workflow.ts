import "server-only"

import type { TaskStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { syncTaskToMonday } from "@/lib/task-sync"

const TERMINAL_TASK_STATUSES: TaskStatus[] = ["DONE", "CANCELLED"]
const DEFAULT_TASK_CATEGORY = "General"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds)
}

function resolveTaskDueDate(params: {
  triggerDate: Date
  dueOffsetDays: number | null
  dueDateAbsolute: Date | null
}) {
  if (params.dueOffsetDays !== null) {
    return addDays(params.triggerDate, params.dueOffsetDays)
  }

  if (params.dueDateAbsolute) {
    return params.dueDateAbsolute
  }

  return null
}

export async function spawnWorkflowForEngagement(engagementId: string) {
  const engagement = await db.engagement.findUnique({
    where: {
      id: engagementId,
    },
    select: {
      id: true,
      source: true,
      meeting_type_key: true,
      party_id: true,
      household_id: true,
      primary_adviser_id: true,
      opened_at: true,
    },
  })

  if (!engagement) {
    console.info(`[workflow] spawn skipped engagement-not-found ${engagementId}`)
    return null
  }

  if (engagement.source !== "CALENDLY") {
    return null
  }

  if (!engagement.meeting_type_key) {
    console.info(`[workflow] spawn skipped missing-meeting-type ${engagement.id}`)
    return null
  }

  const template = await db.workflow_template.findFirst({
    where: {
      trigger_meeting_type_key: engagement.meeting_type_key,
    },
    include: {
      task_templates: {
        orderBy: [
          {
            sort_order: "asc",
          },
          {
            created_at: "asc",
          },
        ],
      },
    },
  })

  if (!template) {
    console.info(
      `[workflow] spawn skipped no-template-for-meeting-type ${engagement.meeting_type_key}`,
    )
    return null
  }

  const existingInstance = await db.workflow_instance.findFirst({
    where: {
      engagement_id: engagement.id,
      workflow_template_id: template.id,
    },
    select: {
      id: true,
    },
  })

  if (existingInstance) {
    return existingInstance
  }

  if (!engagement.party_id) {
    console.info(`[workflow] spawn skipped missing-party ${engagement.id}`)
    return null
  }

  const partyId = engagement.party_id
  const triggerDate = engagement.opened_at
  const now = new Date()
  const createdTaskIds: string[] = []

  const instance = await db.$transaction(async (tx) => {
    const createdInstance = await tx.workflow_instance.create({
      data: {
        workflow_template_id: template.id,
        template_id: template.id,
        template_version: template.version,
        engagement_id: engagement.id,
        party_id: partyId,
        household_id: engagement.household_id,
        status: "active",
        trigger_date: triggerDate,
        current_stage: "active",
        started_at: triggerDate,
        last_event_at: now,
        context_data: {},
        created_at: now,
        updated_at: now,
      },
    })

    for (const taskTemplate of template.task_templates) {
      const dueDateStart = resolveTaskDueDate({
        triggerDate,
        dueOffsetDays: taskTemplate.due_offset_days,
        dueDateAbsolute: taskTemplate.due_date_absolute,
      })

      const ownerUserId = taskTemplate.owner_role === "adviser" ? engagement.primary_adviser_id : null
      const taskType = taskTemplate.category?.trim() || DEFAULT_TASK_CATEGORY

      const task = await tx.task.create({
        data: {
          clientId: partyId,
          title: taskTemplate.title,
          description: taskTemplate.description,
          type: taskType,
          subtype: null,
          status: "NOT_STARTED",
          dueDateStart,
          dueDateEnd: null,
          completedAt: null,
          isRecurring: false,
          recurrenceCadence: null,
          recurrenceEndDate: null,
          recurrenceCount: null,
          parentTaskId: null,
          owners: ownerUserId
            ? {
                create: [{ userId: ownerUserId }],
              }
            : undefined,
        },
        select: {
          id: true,
        },
      })

      createdTaskIds.push(task.id)

      await tx.workflow_spawned_task.create({
        data: {
          workflow_instance_id: createdInstance.id,
          workflow_task_template_id: taskTemplate.id,
          task_id: task.id,
        },
      })
    }

    return createdInstance
  })

  for (const taskId of createdTaskIds) {
    void syncTaskToMonday(taskId).catch((error) => {
      console.error(`[workflow] monday-sync-failed ${taskId} ${toErrorMessage(error)}`)
    })
  }

  return instance
}

export async function rescheduleWorkflowForEngagement(engagementId: string, newTriggerDate: Date) {
  if (Number.isNaN(newTriggerDate.getTime())) {
    console.warn(`[workflow] reschedule skipped invalid-date ${engagementId}`)
    return
  }

  const instances = await db.workflow_instance.findMany({
    where: {
      engagement_id: engagementId,
      status: "active",
    },
    include: {
      spawned_tasks: {
        include: {
          task: true,
        },
      },
    },
  })

  if (instances.length === 0) {
    return
  }

  for (const instance of instances) {
    const deltaMs = newTriggerDate.getTime() - instance.trigger_date.getTime()
    const now = new Date()

    const shiftedTaskIds = await db.$transaction(async (tx) => {
      await tx.workflow_instance.update({
        where: {
          id: instance.id,
        },
        data: {
          trigger_date: newTriggerDate,
          updated_at: now,
          last_event_at: now,
        },
      })

      if (deltaMs === 0) {
        return [] as string[]
      }

      const updatedIds: string[] = []

      for (const spawned of instance.spawned_tasks) {
        const task = spawned.task
        if (TERMINAL_TASK_STATUSES.includes(task.status)) {
          continue
        }

        if (!task.dueDateStart && !task.dueDateEnd) {
          continue
        }

        const dueDateStart = task.dueDateStart ? addMilliseconds(task.dueDateStart, deltaMs) : null
        const dueDateEnd = task.dueDateEnd ? addMilliseconds(task.dueDateEnd, deltaMs) : null

        await tx.task.update({
          where: {
            id: task.id,
          },
          data: {
            dueDateStart,
            dueDateEnd,
          },
        })

        updatedIds.push(task.id)
      }

      return updatedIds
    })

    for (const taskId of shiftedTaskIds) {
      void syncTaskToMonday(taskId).catch((error) => {
        console.error(`[workflow] monday-sync-failed ${taskId} ${toErrorMessage(error)}`)
      })
    }
  }
}
