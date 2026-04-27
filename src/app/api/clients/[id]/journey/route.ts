import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import type {
  ClientJourneyResponse,
  JourneyDecisionState,
  JourneyCurrentInstance,
  JourneyOutcomeCatalogEntry,
  JourneyPhaseTarget,
  JourneyScopedInstance,
  JourneyTaskSummary,
  JourneyTemplateSummary,
  LifecycleStage,
  ServiceSegment,
} from "@/types/journey"

const INITIAL_CONTACT_TEMPLATE_KEY = "initial_contact"
const INITIAL_MEETING_TEMPLATE_KEY = "initial_meeting"
const DISCOVERY_TEMPLATE_KEY = "discovery"
const DECISION_STATE_TEMPLATE_KEYS = [INITIAL_CONTACT_TEMPLATE_KEY, INITIAL_MEETING_TEMPLATE_KEY, DISCOVERY_TEMPLATE_KEY] as const
const SUITABLE_OUTCOME_KEY = "suitable"
const PROCEEDING_TO_DISCOVERY_OUTCOME_KEY = "proceeding_to_discovery"
const ON_HOLD_OUTCOME_KEY = "on_hold"
const INITIAL_CONTACT_MEETING_DURATION_MS = 15 * 60 * 1000

function usesDecisionStateTemplate(templateKey: string) {
  return DECISION_STATE_TEMPLATE_KEYS.includes(templateKey as (typeof DECISION_STATE_TEMPLATE_KEYS)[number])
}
const OUTCOME_READY_BUFFER_MS = 60 * 60 * 1000

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function addMilliseconds(value: Date, milliseconds: number) {
  return new Date(value.getTime() + milliseconds)
}

function toTemplateSummary(template: {
  id: string
  key: string
  name: string
  phase_order: number | null
}): JourneyTemplateSummary {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    phaseOrder: template.phase_order,
  }
}

function toPhaseTarget(template: {
  key: string
  name: string
  phase_order: number | null
} | null): JourneyPhaseTarget | null {
  if (!template || template.phase_order === null) {
    return null
  }

  return {
    key: template.key,
    name: template.name,
    phaseOrder: template.phase_order,
  }
}

function deriveDecisionSnapshot(instance: {
  status: string
  trigger_date: Date
  current_outcome_key: string | null
  workflow_template: {
    key: string
  }
} | null): {
  decisionState: JourneyDecisionState | null
  awaitingEventEndsAt: Date | null
} {
  if (!instance || !usesDecisionStateTemplate(instance.workflow_template.key)) {
    return {
      decisionState: null,
      awaitingEventEndsAt: null,
    }
  }

  if (instance.status === "paused" || instance.current_outcome_key === ON_HOLD_OUTCOME_KEY) {
    return {
      decisionState: "paused",
      awaitingEventEndsAt: null,
    }
  }

  if (!instance.current_outcome_key) {
    const awaitingEventEndsAt = addMilliseconds(
      instance.trigger_date,
      INITIAL_CONTACT_MEETING_DURATION_MS + OUTCOME_READY_BUFFER_MS,
    )

    if (awaitingEventEndsAt.getTime() > Date.now()) {
      return {
        decisionState: "awaiting_event",
        awaitingEventEndsAt,
      }
    }

    return {
      decisionState: "ready_for_outcome",
      awaitingEventEndsAt: null,
    }
  }

  if (
    instance.current_outcome_key === SUITABLE_OUTCOME_KEY ||
    (instance.workflow_template.key === INITIAL_MEETING_TEMPLATE_KEY &&
      instance.current_outcome_key === PROCEEDING_TO_DISCOVERY_OUTCOME_KEY)
  ) {
    return {
      decisionState: "driving_booking",
      awaitingEventEndsAt: null,
    }
  }

  return {
    decisionState: "ready_for_outcome",
    awaitingEventEndsAt: null,
  }
}

async function getOutcomeCatalogForWorkflowTemplate(workflowTemplateId: string): Promise<JourneyOutcomeCatalogEntry[]> {
  const rows = await db.$queryRaw<
    Array<{
      outcome_key: string
      outcome_label: string
      sort_order: number
      is_terminal_lost: boolean
      next_phase_key: string | null
      sets_workflow_status: string | null
    }>
  >`
    SELECT
      wtto.outcome_key,
      wtto.outcome_label,
      wtto.sort_order,
      wtto.is_terminal_lost,
      wtto.next_phase_key,
      wtto.sets_workflow_status
    FROM workflow_task_template_outcome wtto
    JOIN workflow_task_template wtt ON wtt.id = wtto.workflow_task_template_id
    WHERE wtt.workflow_template_id = ${workflowTemplateId}::uuid
    ORDER BY wtt.sort_order ASC, wtto.sort_order ASC, wtto.outcome_key ASC
  `

  return rows.map((row) => ({
    outcomeKey: row.outcome_key,
    outcomeLabel: row.outcome_label,
    sortOrder: row.sort_order,
    isTerminalLost: row.is_terminal_lost,
    nextPhaseKey: row.next_phase_key,
    setsWorkflowStatus: row.sets_workflow_status,
  }))
}

async function getTaskSummaryForInstance(workflowInstanceId: string): Promise<JourneyTaskSummary> {
  const spawnedTasks = await db.workflow_spawned_task.findMany({
    where: {
      workflow_instance_id: workflowInstanceId,
    },
    select: {
      task: {
        select: {
          status: true,
        },
      },
    },
  })

  const relevant = spawnedTasks.filter((entry) => entry.task.status !== "CANCELLED")
  const done = relevant.filter((entry) => entry.task.status === "DONE").length
  const total = relevant.length

  return {
    done,
    total,
    allComplete: total > 0 && done === total,
  }
}

function toScopedInstance(entry: {
  id: string
  engagement_id: string
  status: string
  trigger_date: Date
  created_at: Date
  completed_at: Date | null
  workflow_template: {
    id: string
    key: string
    name: string
    phase_order: number | null
  }
}): JourneyScopedInstance {
  return {
    id: entry.id,
    engagementId: entry.engagement_id,
    status: entry.status,
    triggerDate: entry.trigger_date.toISOString(),
    createdAt: entry.created_at.toISOString(),
    completedAt: entry.completed_at ? entry.completed_at.toISOString() : null,
    template: toTemplateSummary(entry.workflow_template),
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
    const [party, household] = await Promise.all([
      db.party.findUnique({
        where: { id },
        select: { id: true },
      }),
      db.household_group.findUnique({
        where: { id },
        select: { id: true },
      }),
    ])

    if (!party && !household) {
      return NextResponse.json({ error: "client not found", code: "NOT_FOUND" }, { status: 404 })
    }

    const clientScope: "party" | "household" = party ? "party" : "household"

    const activeHouseholdMembers =
      clientScope === "household"
        ? await db.household_member.findMany({
            where: {
              household_id: id,
              end_date: null,
            },
            select: {
              party_id: true,
              role_in_household: true,
              created_at: true,
            },
            orderBy: {
              created_at: "asc",
            },
          })
        : []

    const partyIds =
      clientScope === "party"
        ? [id]
        : activeHouseholdMembers.map((member) => member.party_id)

    const classificationRows =
      partyIds.length > 0
        ? await db.client_classification.findMany({
            where: {
              party_id: {
                in: partyIds,
              },
            },
            select: {
              party_id: true,
              lifecycle_stage: true,
              service_segment: true,
              updated_at: true,
            },
          })
        : []

    const primaryPartyId =
      clientScope === "party"
        ? id
        : activeHouseholdMembers.find((member) => member.role_in_household === "primary")?.party_id ??
          activeHouseholdMembers[0]?.party_id ??
          null

    const preferredClassification =
      (primaryPartyId
        ? classificationRows.find((row) => row.party_id === primaryPartyId)
        : null) ?? classificationRows[0] ?? null

    const lifecycleStage = (preferredClassification?.lifecycle_stage ?? null) as LifecycleStage | null
    const serviceSegment = (preferredClassification?.service_segment ?? null) as ServiceSegment | null
    const lifecycleStageUpdatedAt = preferredClassification?.updated_at?.toISOString() ?? null

    const engagements = await db.engagement.findMany({
      where: {
        OR: [
          {
            party_id: {
              in: partyIds.length > 0 ? partyIds : ["00000000-0000-0000-0000-000000000000"],
            },
          },
          ...(clientScope === "household"
            ? [
                {
                  household_id: id,
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    })

    const mostRecentEngagementId = engagements[0]?.id ?? null
    const engagementIds = engagements.map((entry) => entry.id)

    const workflowInstances =
      engagementIds.length > 0
        ? await db.workflow_instance.findMany({
            where: {
              engagement_id: {
                in: engagementIds,
              },
            },
            include: {
              workflow_template: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  phase_order: true,
                },
              },
            },
            orderBy: {
              created_at: "asc",
            },
          })
        : []

    const activeChainInstances = workflowInstances
      .filter(
        (instance) =>
          (instance.status === "active" || instance.status === "paused") &&
          instance.workflow_template.phase_order !== null,
      )
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())

    const current = activeChainInstances[0] ?? null
    const currentTaskSummary = current ? await getTaskSummaryForInstance(current.id) : null
    const decisionSnapshot = deriveDecisionSnapshot(current)
    const currentOutcomeCatalog =
      current && usesDecisionStateTemplate(current.workflow_template.key)
        ? await getOutcomeCatalogForWorkflowTemplate(current.workflow_template.id)
        : []

    const currentInstance: JourneyCurrentInstance | null =
      current && currentTaskSummary
        ? {
            ...toScopedInstance(current),
            taskSummary: currentTaskSummary,
            decisionState: decisionSnapshot.decisionState,
            awaitingEventEndsAt: toIsoString(decisionSnapshot.awaitingEventEndsAt),
            currentOutcomeKey: current.current_outcome_key,
            noAnswerAttempts: current.no_answer_attempts,
            lastDriverActionKey: current.last_driver_action_key,
            lastDriverActionAt: toIsoString(current.last_driver_action_at),
            nudgesMuted: current.nudges_muted,
            outcomeCatalog: currentOutcomeCatalog,
          }
        : null

    const pastInstances = workflowInstances
      .filter(
        (instance) =>
          instance.workflow_template.phase_order !== null &&
          (instance.status === "completed" || instance.status === "cancelled"),
      )
      .map((instance) => {
        const mapped = toScopedInstance(instance)
        return {
          ...mapped,
          status: mapped.status as "completed" | "cancelled",
        }
      })

    const triggerInstances = workflowInstances
      .filter((instance) => instance.workflow_template.phase_order === null)
      .map((instance) => toScopedInstance(instance))

    const nextPhaseTemplate = current
      ? await db.workflow_template.findFirst({
          where: {
            phase_order: (current.workflow_template.phase_order ?? 0) + 1,
          },
          select: {
            key: true,
            name: true,
            phase_order: true,
          },
          orderBy: {
            created_at: "asc",
          },
        })
      : null

    const availableSkipTargets = current
      ? await db.workflow_template.findMany({
          where: {
            phase_order: {
              gt: current.workflow_template.phase_order ?? -1,
            },
          },
          select: {
            key: true,
            name: true,
            phase_order: true,
          },
          orderBy: {
            phase_order: "asc",
          },
        })
      : []

    const payload: ClientJourneyResponse = {
      clientId: id,
      clientScope,
      lifecycleStage,
      serviceSegment,
      lifecycleStageUpdatedAt,
      currentInstance,
      pastInstances,
      triggerInstances,
      nextPhaseTemplate: toPhaseTarget(nextPhaseTemplate),
      availableSkipTargets: availableSkipTargets
        .filter((template) => template.phase_order !== null)
        .map((template) => ({
          key: template.key,
          name: template.name,
          phaseOrder: template.phase_order as number,
        })),
      mostRecentEngagementId,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error(`[client journey error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load client journey", code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
