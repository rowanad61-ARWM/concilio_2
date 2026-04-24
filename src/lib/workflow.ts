import "server-only"

import type { Prisma, TaskStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { syncTaskToMonday } from "@/lib/task-sync"

const TERMINAL_TASK_STATUSES: TaskStatus[] = ["DONE", "CANCELLED"]
const WORKFLOW_ACTIVE_STATUSES = ["active", "paused"] as const
const WORKFLOW_COMPLETED_OR_STOPPED_STATUSES = ["completed", "cancelled"] as const
const WORKFLOW_TERMINAL_STATUSES = ["completed", "cancelled"] as const
const DEFAULT_TASK_CATEGORY = "General"
const CLOSING_TEMPLATE_KEY = "closing"

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

function isValidDate(value: Date | null | undefined): value is Date {
  if (!value) {
    return false
  }

  return !Number.isNaN(value.getTime())
}

function resolveTaskDueDate(triggerDate: Date, dueOffsetDays: number | null, dueDateAbsolute: Date | null) {
  if (dueOffsetDays !== null) {
    return addDays(triggerDate, dueOffsetDays)
  }

  if (dueDateAbsolute) {
    return dueDateAbsolute
  }

  return null
}

type DbClient = Prisma.TransactionClient | typeof db

type EngagementForWorkflow = {
  id: string
  source: string
  meeting_type_key: string | null
  party_id: string | null
  household_id: string | null
  primary_adviser_id: string | null
  opened_at: Date
}

type WorkflowTemplateWithTasks = Prisma.workflow_templateGetPayload<{
  include: {
    task_templates: true
  }
}>

export type WorkflowInstanceWithTemplate = Prisma.workflow_instanceGetPayload<{
  include: {
    workflow_template: true
  }
}>

type SpawnResult = {
  instance: Prisma.workflow_instanceGetPayload<{
    select: {
      id: true
      status: true
      current_stage: true
      started_at: true
      completed_at: true
      created_at: true
      updated_at: true
      workflow_template_id: true
      engagement_id: true
      trigger_date: true
    }
  }>
  createdTaskIds: string[]
}

export class NoCurrentPhaseError extends Error {
  constructor(message = "No current phase instance exists; specify a target phase to start the journey.") {
    super(message)
    this.name = "NoCurrentPhaseError"
  }
}

export class AlreadyStoppedError extends Error {
  constructor(message = "Client journey is already terminal (lost or ceased).") {
    super(message)
    this.name = "AlreadyStoppedError"
  }
}

export class InvalidTargetPhaseError extends Error {
  constructor(message = "Invalid target phase key.") {
    super(message)
    this.name = "InvalidTargetPhaseError"
  }
}

export class WorkflowTemplateNotFoundError extends Error {
  constructor(message = "Required workflow template was not found.") {
    super(message)
    this.name = "WorkflowTemplateNotFoundError"
  }
}

export class WorkflowEngagementNotFoundError extends Error {
  constructor(message = "Engagement not found.") {
    super(message)
    this.name = "WorkflowEngagementNotFoundError"
  }
}

export class SpawnedTaskNotFoundError extends Error {
  constructor(message = "Spawned task not found.") {
    super(message)
    this.name = "SpawnedTaskNotFoundError"
  }
}

export class InvalidOutcomeError extends Error {
  constructor(message = "Invalid outcome for this task template.") {
    super(message)
    this.name = "InvalidOutcomeError"
  }
}

export class OutcomeTaskNotEligibleError extends Error {
  constructor(message = "Task is not eligible for outcome updates.") {
    super(message)
    this.name = "OutcomeTaskNotEligibleError"
  }
}

export class OutcomeAlreadySetError extends Error {
  constructor(message = "Outcome already set for this spawned task.") {
    super(message)
    this.name = "OutcomeAlreadySetError"
  }
}

export type WorkflowTaskOutcomeCatalogEntry = {
  outcomeKey: string
  outcomeLabel: string
  sortOrder: number
  isTerminalLost: boolean
  nextPhaseKey: string | null
  spawnNextTaskTemplateId: string | null
  setsWorkflowStatus: string | null
  maxAttempts: number | null
}

export type TaskOutcomeCatalog = {
  taskId: string
  spawnedTaskId: string | null
  templateTitle: string | null
  outcomes: WorkflowTaskOutcomeCatalogEntry[]
}

export type OutcomeResult =
  | {
      effect: "stopped"
      taskId: string
      spawnedTaskId: string
    }
  | {
      effect: "advanced"
      taskId: string
      spawnedTaskId: string
      targetPhase: string
    }
  | {
      effect: "continued"
      taskId: string
      spawnedTaskId: string
      spawnedTaskIdCreated: string | null
      workflowStatus: string | null
    }
  | {
      effect: "needs_review"
      taskId: string
      spawnedTaskId: string
      attempts: number
      maxAttempts: number | null
    }

function toStageFromTemplateKey(templateKey: string | null) {
  if (!templateKey) {
    return "client"
  }

  if (templateKey === "initial_contact") {
    return "prospect"
  }

  if (templateKey === "initial_meeting") {
    return "prospect"
  }

  if (templateKey === "engagement") {
    return "engagement"
  }

  if (templateKey === "advice") {
    return "advice"
  }

  if (templateKey === "implementation") {
    return "implementation"
  }

  return null
}

function toSystemCancellationNote(reason: "advance" | "stop") {
  if (reason === "advance") {
    return "Cancelled: workflow advanced to next phase."
  }

  return "Cancelled: client journey stopped."
}

async function syncTaskIdsToMonday(taskIds: Iterable<string>) {
  const uniqueTaskIds = Array.from(new Set(Array.from(taskIds).filter(Boolean)))
  for (const taskId of uniqueTaskIds) {
    void syncTaskToMonday(taskId).catch((error) => {
      console.error(`[workflow] monday-sync-failed ${taskId} ${toErrorMessage(error)}`)
    })
  }
}

async function loadEngagementForWorkflow(client: DbClient, engagementId: string): Promise<EngagementForWorkflow | null> {
  return client.engagement.findUnique({
    where: { id: engagementId },
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
}

async function resolveSpawnTemplate(
  client: DbClient,
  engagement: EngagementForWorkflow,
  explicitTemplateId: string | null,
): Promise<WorkflowTemplateWithTasks | null> {
  if (explicitTemplateId) {
    return client.workflow_template.findUnique({
      where: { id: explicitTemplateId },
      include: {
        task_templates: {
          orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        },
      },
    })
  }

  if (engagement.source !== "CALENDLY") {
    return null
  }

  if (!engagement.meeting_type_key) {
    return null
  }

  return client.workflow_template.findFirst({
    where: {
      trigger_meeting_type_key: engagement.meeting_type_key,
    },
    include: {
      task_templates: {
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      },
    },
  })
}

type WorkflowTaskOutcomeRow = {
  workflow_task_template_id: string
  outcome_key: string
  outcome_label: string
  sort_order: number
  is_terminal_lost: boolean
  next_phase_key: string | null
  spawn_next_task_template_id: string | null
  sets_workflow_status: string | null
  max_attempts: number | null
}

function isMissingOutcomeColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return maybeMessage.includes("spawn_next_task_template_id")
}

async function getOutcomeCatalogForTemplateId(
  client: DbClient,
  workflowTaskTemplateId: string,
): Promise<WorkflowTaskOutcomeRow[]> {
  return client.$queryRaw<WorkflowTaskOutcomeRow[]>`
    SELECT
      workflow_task_template_id,
      outcome_key,
      outcome_label,
      sort_order,
      is_terminal_lost,
      next_phase_key,
      spawn_next_task_template_id,
      sets_workflow_status,
      max_attempts
    FROM workflow_task_template_outcome
    WHERE workflow_task_template_id = ${workflowTaskTemplateId}::uuid
    ORDER BY sort_order ASC, outcome_key ASC
  `
}

async function resolveRootTaskTemplates(
  client: DbClient,
  template: WorkflowTemplateWithTasks,
) {
  try {
    // Exclude self-loop outcomes (for retry semantics like no_answer -> same template)
    // so retryable root tasks are not incorrectly filtered out during initial spawn.
    const downstreamRows = await client.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT spawn_next_task_template_id::text AS id
      FROM workflow_task_template_outcome
      WHERE spawn_next_task_template_id IS NOT NULL
        AND spawn_next_task_template_id <> workflow_task_template_id
        AND workflow_task_template_id IN (
          SELECT id
          FROM workflow_task_template
          WHERE workflow_template_id = ${template.id}::uuid
        )
    `
    const downstreamTemplateIds = new Set(downstreamRows.map((row) => row.id))
    return template.task_templates.filter((taskTemplate) => !downstreamTemplateIds.has(taskTemplate.id))
  } catch (error) {
    if (isMissingOutcomeColumnError(error)) {
      return template.task_templates
    }

    throw error
  }
}

async function createSpawnedTaskFromTemplate(
  client: DbClient,
  params: {
    workflowInstanceId: string
    triggerDate: Date
    engagement: EngagementForWorkflow
    taskTemplate: {
      id: string
      title: string
      description: string | null
      category: string | null
      owner_role: string
      due_offset_days: number | null
      due_date_absolute: Date | null
    }
  },
) {
  const { workflowInstanceId, triggerDate, engagement, taskTemplate } = params

  if (!engagement.party_id) {
    throw new Error(`workflow-instance ${workflowInstanceId} missing party_id`)
  }

  const dueDateStart = resolveTaskDueDate(
    triggerDate,
    taskTemplate.due_offset_days,
    taskTemplate.due_date_absolute,
  )
  const ownerUserId = taskTemplate.owner_role === "adviser" ? engagement.primary_adviser_id : null
  const taskType = taskTemplate.category?.trim() || DEFAULT_TASK_CATEGORY

  const task = await client.task.create({
    data: {
      clientId: engagement.party_id,
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

  await client.workflow_spawned_task.create({
    data: {
      workflow_instance_id: workflowInstanceId,
      workflow_task_template_id: taskTemplate.id,
      task_id: task.id,
    },
  })

  return task.id
}

async function spawnWorkflowWithTemplate(
  client: DbClient,
  engagement: EngagementForWorkflow,
  template: WorkflowTemplateWithTasks,
  triggerDate: Date,
): Promise<SpawnResult | null> {
  if (!engagement.party_id) {
    console.info(`[workflow] spawn skipped missing-party ${engagement.id}`)
    return null
  }

  const existingInstance = await client.workflow_instance.findFirst({
    where: {
      engagement_id: engagement.id,
      workflow_template_id: template.id,
      status: {
        in: [...WORKFLOW_ACTIVE_STATUSES],
      },
    },
    select: {
      id: true,
      status: true,
      current_stage: true,
      started_at: true,
      completed_at: true,
      created_at: true,
      updated_at: true,
      workflow_template_id: true,
      engagement_id: true,
      trigger_date: true,
    },
  })

  if (existingInstance) {
    return {
      instance: existingInstance,
      createdTaskIds: [],
    }
  }

  const now = new Date()
  const createdTaskIds: string[] = []

  const createdInstance = await client.workflow_instance.create({
    data: {
      workflow_template_id: template.id,
      template_id: template.id,
      template_version: template.version,
      engagement_id: engagement.id,
      party_id: engagement.party_id,
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
    select: {
      id: true,
      status: true,
      current_stage: true,
      started_at: true,
      completed_at: true,
      created_at: true,
      updated_at: true,
      workflow_template_id: true,
      engagement_id: true,
      trigger_date: true,
    },
  })

  // Only root task templates spawn at workflow start.
  // Downstream templates are spawned by setOutcomeForSpawnedTask via spawn_next_task_template_id.
  const rootTaskTemplates = await resolveRootTaskTemplates(client, template)

  for (const taskTemplate of rootTaskTemplates) {
    const createdTaskId = await createSpawnedTaskFromTemplate(client, {
      workflowInstanceId: createdInstance.id,
      triggerDate,
      engagement,
      taskTemplate,
    })

    createdTaskIds.push(createdTaskId)
  }

  return {
    instance: createdInstance,
    createdTaskIds,
  }
}

async function getClassificationForEngagement(client: DbClient, engagement: { party_id: string | null; household_id: string | null }) {
  if (engagement.party_id) {
    return client.client_classification.findUnique({
      where: {
        party_id: engagement.party_id,
      },
      select: {
        id: true,
        lifecycle_stage: true,
        service_segment: true,
      },
    })
  }

  if (engagement.household_id) {
    return client.client_classification.findFirst({
      where: {
        household_id: engagement.household_id,
      },
      orderBy: {
        created_at: "asc",
      },
      select: {
        id: true,
        lifecycle_stage: true,
        service_segment: true,
      },
    })
  }

  return null
}

async function upsertLifecycleStageForEngagement(
  tx: Prisma.TransactionClient,
  engagement: { party_id: string | null; household_id: string | null },
  lifecycleStage: string,
) {
  const now = new Date()

  if (engagement.party_id) {
    const existing = await tx.client_classification.findUnique({
      where: {
        party_id: engagement.party_id,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      await tx.client_classification.update({
        where: {
          id: existing.id,
        },
        data: {
          lifecycle_stage: lifecycleStage,
          updated_at: now,
        },
      })
      return
    }

    await tx.client_classification.create({
      data: {
        party_id: engagement.party_id,
        household_id: null,
        lifecycle_stage: lifecycleStage,
        created_at: now,
        updated_at: now,
      },
    })
    return
  }

  if (!engagement.household_id) {
    throw new Error("engagement-missing-party-and-household")
  }

  const members = await tx.household_member.findMany({
    where: {
      household_id: engagement.household_id,
      end_date: null,
    },
    select: {
      party_id: true,
    },
  })

  const partyIds = Array.from(new Set(members.map((member) => member.party_id))).filter(Boolean)
  if (partyIds.length === 0) {
    throw new Error("engagement-household-has-no-active-members")
  }

  for (const partyId of partyIds) {
    const existing = await tx.client_classification.findUnique({
      where: {
        party_id: partyId,
      },
      select: {
        id: true,
      },
    })

    if (existing) {
      await tx.client_classification.update({
        where: {
          id: existing.id,
        },
        data: {
          lifecycle_stage: lifecycleStage,
          updated_at: now,
        },
      })
      continue
    }

    await tx.client_classification.create({
      data: {
        party_id: partyId,
        household_id: null,
        lifecycle_stage: lifecycleStage,
        created_at: now,
        updated_at: now,
      },
    })
  }
}

async function resolveTimelineAuthorId(
  tx: Prisma.TransactionClient,
  engagement: { primary_adviser_id: string | null },
) {
  if (engagement.primary_adviser_id) {
    const adviser = await tx.user_account.findUnique({
      where: {
        id: engagement.primary_adviser_id,
      },
      select: {
        id: true,
      },
    })

    if (adviser) {
      return adviser.id
    }
  }

  const fallback = await tx.user_account.findFirst({
    orderBy: {
      created_at: "asc",
    },
    select: {
      id: true,
    },
  })

  return fallback?.id ?? null
}

async function createJourneyTimelineEvent(
  tx: Prisma.TransactionClient,
  params: {
    engagementId: string
    partyId: string | null
    householdId: string | null
    primaryAdviserId: string | null
    note: string
    at: Date
  },
) {
  const authorId = await resolveTimelineAuthorId(tx, { primary_adviser_id: params.primaryAdviserId })
  if (!authorId) {
    console.warn(`[workflow] timeline-event-skipped missing-author ${params.engagementId}`)
    return
  }

  await tx.file_note.create({
    data: {
      party_id: params.partyId,
      household_id: params.householdId,
      engagement_id: params.engagementId,
      note_type: "general",
      text: params.note,
      author_user_id: authorId,
      created_at: params.at,
      updated_at: params.at,
    },
  })
}

export async function cancelIncompleteSpawnedTasks(
  tx: Prisma.TransactionClient,
  workflowInstanceId: string,
  reason: "advance" | "stop",
) {
  const spawnedTasks = await tx.workflow_spawned_task.findMany({
    where: {
      workflow_instance_id: workflowInstanceId,
    },
    include: {
      task: {
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
      },
    },
  })

  const cancelledTaskIds: string[] = []
  const noteBody = toSystemCancellationNote(reason)

  for (const spawned of spawnedTasks) {
    const task = spawned.task
    if (!task || TERMINAL_TASK_STATUSES.includes(task.status)) {
      continue
    }

    await tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        status: "CANCELLED",
        completedAt: task.completedAt ?? new Date(),
      },
    })

    await tx.taskNote.create({
      data: {
        taskId: task.id,
        authorId: null,
        source: "SYSTEM",
        body: noteBody,
      },
    })

    cancelledTaskIds.push(task.id)
  }

  return cancelledTaskIds
}

async function spawnForEngagementWithOptionalTemplate(
  client: DbClient,
  engagement: EngagementForWorkflow,
  templateId: string | null,
  triggerDate: Date,
) {
  const template = await resolveSpawnTemplate(client, engagement, templateId)
  if (!template) {
    return null
  }

  return spawnWorkflowWithTemplate(client, engagement, template, triggerDate)
}

export async function spawnWorkflowForEngagement(
  engagementId: string,
  explicitTemplateId?: string | null,
  explicitTriggerDate?: Date,
) {
  const engagement = await loadEngagementForWorkflow(db, engagementId)
  if (!engagement) {
    console.info(`[workflow] spawn skipped engagement-not-found ${engagementId}`)
    return null
  }

  const triggerDate = isValidDate(explicitTriggerDate) ? explicitTriggerDate : engagement.opened_at
  const result = await db.$transaction(async (tx) =>
    spawnForEngagementWithOptionalTemplate(tx, engagement, explicitTemplateId ?? null, triggerDate),
  )

  if (!result) {
    if (explicitTemplateId) {
      console.info(`[workflow] spawn skipped template-not-found ${explicitTemplateId}`)
    } else if (engagement.source !== "CALENDLY") {
      console.info(`[workflow] spawn skipped non-calendly ${engagement.id}`)
    } else if (!engagement.meeting_type_key) {
      console.info(`[workflow] spawn skipped missing-meeting-type ${engagement.id}`)
    } else {
      console.info(`[workflow] spawn skipped no-template-for-meeting-type ${engagement.meeting_type_key}`)
    }
    return null
  }

  await syncTaskIdsToMonday(result.createdTaskIds)
  return result.instance
}

export async function getTaskOutcomeCatalog(taskId: string): Promise<TaskOutcomeCatalog> {
  const spawnedTask = await db.workflow_spawned_task.findFirst({
    where: {
      task_id: taskId,
    },
    select: {
      id: true,
      workflow_task_template_id: true,
      workflow_task_template: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!spawnedTask) {
    return {
      taskId,
      spawnedTaskId: null,
      templateTitle: null,
      outcomes: [],
    }
  }

  const outcomes = await getOutcomeCatalogForTemplateId(db, spawnedTask.workflow_task_template_id)

  return {
    taskId,
    spawnedTaskId: spawnedTask.id,
    templateTitle: spawnedTask.workflow_task_template.title,
    outcomes: outcomes.map((row) => ({
      outcomeKey: row.outcome_key,
      outcomeLabel: row.outcome_label,
      sortOrder: row.sort_order,
      isTerminalLost: row.is_terminal_lost,
      nextPhaseKey: row.next_phase_key,
      spawnNextTaskTemplateId: row.spawn_next_task_template_id,
      setsWorkflowStatus: row.sets_workflow_status,
      maxAttempts: row.max_attempts,
    })),
  }
}

export async function setOutcomeForSpawnedTask(
  spawnedTaskId: string,
  outcomeKey: string,
  userId: string,
): Promise<OutcomeResult> {
  const normalizedOutcomeKey = outcomeKey.trim()
  if (!normalizedOutcomeKey) {
    throw new InvalidOutcomeError("Outcome key is required.")
  }

  const spawnedTask = await db.workflow_spawned_task.findUnique({
    where: {
      id: spawnedTaskId,
    },
    include: {
      task: {
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
      },
      workflow_task_template: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          owner_role: true,
          due_offset_days: true,
          due_date_absolute: true,
        },
      },
      workflow_instance: {
        select: {
          id: true,
          status: true,
          trigger_date: true,
          engagement_id: true,
          party_id: true,
          household_id: true,
          engagement: {
            select: {
              id: true,
              source: true,
              meeting_type_key: true,
              party_id: true,
              household_id: true,
              primary_adviser_id: true,
              opened_at: true,
            },
          },
        },
      },
    },
  })

  if (!spawnedTask || !spawnedTask.task || !spawnedTask.workflow_instance) {
    throw new SpawnedTaskNotFoundError()
  }

  if (spawnedTask.outcome_key) {
    throw new OutcomeAlreadySetError()
  }

  if (TERMINAL_TASK_STATUSES.includes(spawnedTask.task.status)) {
    throw new OutcomeTaskNotEligibleError("Task is already terminal.")
  }

  if (
    WORKFLOW_TERMINAL_STATUSES.includes(
      spawnedTask.workflow_instance.status as (typeof WORKFLOW_TERMINAL_STATUSES)[number],
    )
  ) {
    throw new OutcomeTaskNotEligibleError("Workflow instance is terminal.")
  }

  const outcomeRows = await getOutcomeCatalogForTemplateId(db, spawnedTask.workflow_task_template_id)
  const selectedOutcome = outcomeRows.find((row) => row.outcome_key === normalizedOutcomeKey)
  if (!selectedOutcome) {
    throw new InvalidOutcomeError()
  }

  const engagement = spawnedTask.workflow_instance.engagement
  if (!engagement) {
    throw new WorkflowEngagementNotFoundError()
  }

  const now = new Date()

  if (selectedOutcome.is_terminal_lost) {
    await db.$transaction(async (tx) => {
      await tx.workflow_spawned_task.update({
        where: {
          id: spawnedTask.id,
        },
        data: {
          outcome_key: normalizedOutcomeKey,
          outcome_set_at: now,
          outcome_set_by: userId,
        },
      })

      await tx.task.update({
        where: {
          id: spawnedTask.task.id,
        },
        data: {
          status: "DONE",
          completedAt: now,
        },
      })

      await createJourneyTimelineEvent(tx, {
        engagementId: engagement.id,
        partyId: engagement.party_id,
        householdId: engagement.household_id,
        primaryAdviserId: engagement.primary_adviser_id,
        note: "Initial Contact closed - Not Suitable",
        at: now,
      })
    })

    await stopEngagementWorkflow(engagement.id)
    await syncTaskIdsToMonday([spawnedTask.task.id])

    return {
      effect: "stopped",
      taskId: spawnedTask.task.id,
      spawnedTaskId: spawnedTask.id,
    }
  }

  if (selectedOutcome.next_phase_key) {
    await db.$transaction(async (tx) => {
      await tx.workflow_spawned_task.update({
        where: {
          id: spawnedTask.id,
        },
        data: {
          outcome_key: normalizedOutcomeKey,
          outcome_set_at: now,
          outcome_set_by: userId,
        },
      })

      await tx.task.update({
        where: {
          id: spawnedTask.task.id,
        },
        data: {
          status: "DONE",
          completedAt: now,
        },
      })
    })

    await advanceEngagementToNextPhase(engagement.id, {
      targetPhaseKey: selectedOutcome.next_phase_key,
      advanceDate: now,
    })

    await syncTaskIdsToMonday([spawnedTask.task.id])

    return {
      effect: "advanced",
      taskId: spawnedTask.task.id,
      spawnedTaskId: spawnedTask.id,
      targetPhase: selectedOutcome.next_phase_key,
    }
  }

  const touchedTaskIds = new Set<string>([spawnedTask.task.id])

  const result = await db.$transaction(async (tx) => {
    await tx.workflow_spawned_task.update({
      where: {
        id: spawnedTask.id,
      },
      data: {
        outcome_key: normalizedOutcomeKey,
        outcome_set_at: now,
        outcome_set_by: userId,
      },
    })

    let spawnedTaskIdCreated: string | null = null
    let workflowStatus: string | null = null

    if (selectedOutcome.spawn_next_task_template_id) {
      const existingAttempts = await tx.workflow_spawned_task.count({
        where: {
          workflow_instance_id: spawnedTask.workflow_instance_id,
          workflow_task_template_id: selectedOutcome.spawn_next_task_template_id,
        },
      })

      const maxAttempts = selectedOutcome.max_attempts
      if (maxAttempts !== null && existingAttempts >= maxAttempts) {
        await tx.task.update({
          where: {
            id: spawnedTask.task.id,
          },
          data: {
            status: "NEEDS_REVIEW",
            completedAt: null,
          },
        })

        await createJourneyTimelineEvent(tx, {
          engagementId: engagement.id,
          partyId: engagement.party_id,
          householdId: engagement.household_id,
          primaryAdviserId: engagement.primary_adviser_id,
          note: `Retries exhausted for "${spawnedTask.workflow_task_template.title}" (${existingAttempts}/${maxAttempts}). Marked as Needs Review.`,
          at: now,
        })

        return {
          effect: "needs_review" as const,
          spawnedTaskIdCreated: null,
          workflowStatus: null,
          attempts: existingAttempts,
          maxAttempts,
        }
      }

      await tx.task.update({
        where: {
          id: spawnedTask.task.id,
        },
        data: {
          status: "DONE",
          completedAt: now,
        },
      })

      const nextTaskTemplate = await tx.workflow_task_template.findUnique({
        where: {
          id: selectedOutcome.spawn_next_task_template_id,
        },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          owner_role: true,
          due_offset_days: true,
          due_date_absolute: true,
        },
      })

      if (nextTaskTemplate) {
        spawnedTaskIdCreated = await createSpawnedTaskFromTemplate(tx, {
          workflowInstanceId: spawnedTask.workflow_instance_id,
          triggerDate: spawnedTask.workflow_instance.trigger_date,
          engagement,
          taskTemplate: nextTaskTemplate,
        })
        touchedTaskIds.add(spawnedTaskIdCreated)
      }
    } else {
      await tx.task.update({
        where: {
          id: spawnedTask.task.id,
        },
        data: {
          status: "DONE",
          completedAt: now,
        },
      })
    }

    if (selectedOutcome.sets_workflow_status) {
      workflowStatus = selectedOutcome.sets_workflow_status
      await tx.workflow_instance.update({
        where: {
          id: spawnedTask.workflow_instance_id,
        },
        data: {
          status: selectedOutcome.sets_workflow_status,
          last_event_at: now,
          updated_at: now,
        },
      })

      if (selectedOutcome.sets_workflow_status === "paused") {
        await createJourneyTimelineEvent(tx, {
          engagementId: engagement.id,
          partyId: engagement.party_id,
          householdId: engagement.household_id,
          primaryAdviserId: engagement.primary_adviser_id,
          note: "Initial Contact paused - on hold",
          at: now,
        })
      }
    }

    return {
      effect: "continued" as const,
      spawnedTaskIdCreated,
      workflowStatus,
    }
  })

  await syncTaskIdsToMonday(touchedTaskIds)

  if (result.effect === "needs_review") {
    return {
      effect: "needs_review",
      taskId: spawnedTask.task.id,
      spawnedTaskId: spawnedTask.id,
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
    }
  }

  return {
    effect: "continued",
    taskId: spawnedTask.task.id,
    spawnedTaskId: spawnedTask.id,
    spawnedTaskIdCreated: result.spawnedTaskIdCreated,
    workflowStatus: result.workflowStatus,
  }
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

    await syncTaskIdsToMonday(shiftedTaskIds)
  }
}

export async function getCurrentAdvanceChainInstance(engagementId: string): Promise<WorkflowInstanceWithTemplate | null> {
  const activeInstances = await db.workflow_instance.findMany({
    where: {
      engagement_id: engagementId,
      status: "active",
      workflow_template: {
        phase_order: {
          not: null,
        },
      },
    },
    include: {
      workflow_template: true,
    },
    orderBy: {
      created_at: "desc",
    },
    take: 10,
  })

  if (activeInstances.length > 1) {
    console.warn(
      `[workflow] multiple-active-chain-instances ${engagementId} returning-most-recent ${activeInstances[0]?.id ?? "unknown"}`,
    )
  }

  return activeInstances[0] ?? null
}

export async function getJourneyState(engagementId: string) {
  const engagement = await db.engagement.findUnique({
    where: {
      id: engagementId,
    },
    select: {
      id: true,
      party_id: true,
      household_id: true,
    },
  })

  if (!engagement) {
    throw new WorkflowEngagementNotFoundError()
  }

  const allInstances = await db.workflow_instance.findMany({
    where: {
      engagement_id: engagementId,
    },
    include: {
      workflow_template: true,
    },
    orderBy: {
      created_at: "asc",
    },
  })

  const activeChain = allInstances
    .filter((instance) => instance.status === "active" && instance.workflow_template.phase_order !== null)
    .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())

  if (activeChain.length > 1) {
    console.warn(
      `[workflow] multiple-active-chain-instances ${engagementId} returning-most-recent ${activeChain[0]?.id ?? "unknown"}`,
    )
  }

  const currentInstance = activeChain[0] ?? null
  const completed = allInstances.filter(
    (instance) =>
      instance.workflow_template.phase_order !== null &&
      WORKFLOW_COMPLETED_OR_STOPPED_STATUSES.includes(
        instance.status as (typeof WORKFLOW_COMPLETED_OR_STOPPED_STATUSES)[number],
      ),
  )
  const triggerInstances = allInstances.filter(
    (instance) =>
      instance.workflow_template.phase_order === null &&
      (instance.status === "active" || instance.status === "completed"),
  )

  const nextPhaseTemplate =
    currentInstance && currentInstance.workflow_template.phase_order !== null
      ? await db.workflow_template.findFirst({
          where: {
            phase_order: currentInstance.workflow_template.phase_order + 1,
          },
          orderBy: {
            created_at: "asc",
          },
        })
      : null

  const availableSkipTargets = await db.workflow_template.findMany({
    where: {
      phase_order: currentInstance
        ? {
            gt: currentInstance.workflow_template.phase_order ?? -1,
          }
        : {
            not: null,
          },
    },
    orderBy: {
      phase_order: "asc",
    },
  })

  const classification = await getClassificationForEngagement(db, engagement)

  return {
    current: currentInstance
      ? {
          instance: currentInstance,
          template: currentInstance.workflow_template,
        }
      : null,
    completed: completed.map((entry) => ({
      instance: entry,
      template: entry.workflow_template,
    })),
    triggerInstances: triggerInstances.map((entry) => ({
      instance: entry,
      template: entry.workflow_template,
    })),
    nextPhaseTemplate,
    availableSkipTargets,
    lifecycleStage: classification?.lifecycle_stage ?? null,
    serviceSegment: classification?.service_segment ?? null,
  }
}

export async function advanceEngagementToNextPhase(
  engagementId: string,
  options?: {
    targetPhaseKey?: string
    advanceDate?: Date
  },
) {
  const advanceDate = isValidDate(options?.advanceDate) ? options!.advanceDate : new Date()

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
    throw new WorkflowEngagementNotFoundError()
  }

  const current = await getCurrentAdvanceChainInstance(engagementId)
  let targetTemplate: Prisma.workflow_templateGetPayload<{ select: { id: true; key: true; name: true; phase_order: true } }> | null =
    null

  if (options?.targetPhaseKey?.trim()) {
    const targetPhaseKey = options.targetPhaseKey.trim()
    targetTemplate = await db.workflow_template.findFirst({
      where: {
        key: targetPhaseKey,
        phase_order: {
          not: null,
        },
      },
      select: {
        id: true,
        key: true,
        name: true,
        phase_order: true,
      },
    })

    if (!targetTemplate || targetTemplate.phase_order === null) {
      throw new InvalidTargetPhaseError(`Target phase "${targetPhaseKey}" is not a valid chain phase.`)
    }

    if (
      current &&
      current.workflow_template.phase_order !== null &&
      targetTemplate.phase_order <= current.workflow_template.phase_order
    ) {
      throw new InvalidTargetPhaseError(
        `Target phase "${targetPhaseKey}" must be after current phase "${current.workflow_template.key}".`,
      )
    }
  } else {
    if (!current || current.workflow_template.phase_order === null) {
      throw new NoCurrentPhaseError()
    }

    targetTemplate = await db.workflow_template.findFirst({
      where: {
        phase_order: current.workflow_template.phase_order + 1,
      },
      select: {
        id: true,
        key: true,
        name: true,
        phase_order: true,
      },
    })
  }

  const targetLifecycleStage = toStageFromTemplateKey(targetTemplate?.key ?? null)
  if (!targetLifecycleStage) {
    throw new InvalidTargetPhaseError(`Target phase "${targetTemplate?.key ?? "unknown"}" is not in the configured lifecycle mapping.`)
  }

  const touchedTaskIds = new Set<string>()

  const transactionResult = await db.$transaction(async (tx) => {
    let closedInstance: Prisma.workflow_instanceGetPayload<{ select: { id: true; status: true; completed_at: true; workflow_template_id: true } }> | null =
      null
    let newInstance: Prisma.workflow_instanceGetPayload<{
      select: {
        id: true
        status: true
        current_stage: true
        started_at: true
        completed_at: true
        created_at: true
        updated_at: true
        workflow_template_id: true
        engagement_id: true
        trigger_date: true
      }
    }> | null = null

    if (current) {
      const cancelledTaskIds = await cancelIncompleteSpawnedTasks(tx, current.id, "advance")
      for (const taskId of cancelledTaskIds) {
        touchedTaskIds.add(taskId)
      }

      closedInstance = await tx.workflow_instance.update({
        where: {
          id: current.id,
        },
        data: {
          status: "completed",
          completed_at: advanceDate,
          last_event_at: advanceDate,
          updated_at: advanceDate,
        },
        select: {
          id: true,
          status: true,
          completed_at: true,
          workflow_template_id: true,
        },
      })
    }

    if (targetTemplate) {
      const spawnResult = await spawnForEngagementWithOptionalTemplate(tx, engagement, targetTemplate.id, advanceDate)
      if (!spawnResult) {
        throw new WorkflowTemplateNotFoundError(`Unable to spawn workflow for template "${targetTemplate.key}".`)
      }

      newInstance = spawnResult.instance
      for (const taskId of spawnResult.createdTaskIds) {
        touchedTaskIds.add(taskId)
      }
    }

    await upsertLifecycleStageForEngagement(tx, engagement, targetLifecycleStage)

    const timelineMessage =
      targetTemplate && current
        ? `Advanced from ${current.workflow_template.name} to ${targetTemplate.name}`
        : targetTemplate && !current
          ? `Started client journey at ${targetTemplate.name}`
          : "Completed final phase - now active client"

    await createJourneyTimelineEvent(tx, {
      engagementId: engagement.id,
      partyId: engagement.party_id,
      householdId: engagement.household_id,
      primaryAdviserId: engagement.primary_adviser_id,
      note: timelineMessage,
      at: advanceDate,
    })

    return {
      closedInstance,
      newInstance,
      lifecycleStage: targetLifecycleStage,
      atEndOfChain: targetTemplate === null,
    }
  })

  await syncTaskIdsToMonday(touchedTaskIds)
  return transactionResult
}

export async function stopEngagementWorkflow(engagementId: string, stopDate?: Date) {
  const effectiveStopDate = isValidDate(stopDate) ? stopDate : new Date()

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
    throw new WorkflowEngagementNotFoundError()
  }

  const current = await getCurrentAdvanceChainInstance(engagementId)
  const classification = await getClassificationForEngagement(db, engagement)
  const preStopStage = classification?.lifecycle_stage ?? null

  if (preStopStage === "lost" || preStopStage === "ceased") {
    throw new AlreadyStoppedError()
  }

  const terminalStage = preStopStage === "client" ? "ceased" : "lost"
  const closingTemplate = await db.workflow_template.findUnique({
    where: {
      key: CLOSING_TEMPLATE_KEY,
    },
    select: {
      id: true,
      key: true,
      name: true,
    },
  })

  if (!closingTemplate) {
    throw new WorkflowTemplateNotFoundError(`Template "${CLOSING_TEMPLATE_KEY}" not found.`)
  }

  const touchedTaskIds = new Set<string>()

  const transactionResult = await db.$transaction(async (tx) => {
    let closedInstance: Prisma.workflow_instanceGetPayload<{ select: { id: true; status: true; completed_at: true; workflow_template_id: true } }> | null =
      null

    if (current) {
      const cancelledTaskIds = await cancelIncompleteSpawnedTasks(tx, current.id, "stop")
      for (const taskId of cancelledTaskIds) {
        touchedTaskIds.add(taskId)
      }

      closedInstance = await tx.workflow_instance.update({
        where: {
          id: current.id,
        },
        data: {
          status: "cancelled",
          completed_at: effectiveStopDate,
          last_event_at: effectiveStopDate,
          updated_at: effectiveStopDate,
        },
        select: {
          id: true,
          status: true,
          completed_at: true,
          workflow_template_id: true,
        },
      })
    }

    const spawnResult = await spawnForEngagementWithOptionalTemplate(
      tx,
      engagement,
      closingTemplate.id,
      effectiveStopDate,
    )
    if (!spawnResult) {
      throw new WorkflowTemplateNotFoundError(`Unable to spawn closing workflow for engagement "${engagement.id}".`)
    }

    for (const taskId of spawnResult.createdTaskIds) {
      touchedTaskIds.add(taskId)
    }

    await upsertLifecycleStageForEngagement(tx, engagement, terminalStage)

    await createJourneyTimelineEvent(tx, {
      engagementId: engagement.id,
      partyId: engagement.party_id,
      householdId: engagement.household_id,
      primaryAdviserId: engagement.primary_adviser_id,
      note: `Client journey stopped (marked ${terminalStage})`,
      at: effectiveStopDate,
    })

    return {
      closedInstance,
      closingInstance: spawnResult.instance,
      terminalStage,
    }
  })

  await syncTaskIdsToMonday(touchedTaskIds)
  return transactionResult
}
