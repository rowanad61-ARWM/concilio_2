import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { getJourneyState, WorkflowEngagementNotFoundError } from "@/lib/workflow"
import type {
  EngagementJourneyEntry,
  EngagementJourneyResponse,
  JourneyPhaseTarget,
  JourneyScopedInstance,
  JourneyTaskSummary,
  JourneyTemplateSummary,
} from "@/types/journey"

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
  if (!value) {
    return null
  }

  return value.toISOString()
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

function toScopedInstance(instance: {
  id: string
  engagement_id: string
  trigger_date: Date
  created_at: Date
  completed_at: Date | null
  status: string
}): JourneyScopedInstance {
  return {
    id: instance.id,
    engagementId: instance.engagement_id,
    status: instance.status,
    triggerDate: instance.trigger_date.toISOString(),
    createdAt: instance.created_at.toISOString(),
    completedAt: toIsoString(instance.completed_at),
    template: {
      id: "",
      key: "",
      name: "",
      phaseOrder: null,
    },
  }
}

function toEntry(entry: {
  instance: {
    id: string
    engagement_id: string
    trigger_date: Date
    created_at: Date
    completed_at: Date | null
    status: string
  }
  template: {
    id: string
    key: string
    name: string
    phase_order: number | null
  }
}): EngagementJourneyEntry {
  const instance = toScopedInstance(entry.instance)
  return {
    instance: {
      ...instance,
      template: toTemplateSummary(entry.template),
    },
    template: toTemplateSummary(entry.template),
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
    const state = await getJourneyState(id)
    const currentPhaseTaskSummary = state.current?.instance.id
      ? await getTaskSummaryForInstance(state.current.instance.id)
      : null

    const payload: EngagementJourneyResponse = {
      current: state.current ? toEntry(state.current) : null,
      completed: state.completed.map((entry) => toEntry(entry)),
      triggerInstances: state.triggerInstances.map((entry) => toEntry(entry)),
      nextPhaseTemplate: toPhaseTarget(state.nextPhaseTemplate),
      availableSkipTargets: state.availableSkipTargets
        .filter((template) => template.phase_order !== null)
        .map((template) => ({
          key: template.key,
          name: template.name,
          phaseOrder: template.phase_order as number,
        })),
      lifecycleStage: state.lifecycleStage as EngagementJourneyResponse["lifecycleStage"],
      currentPhaseTaskSummary,
      decisionState: state.decisionState,
      awaitingEventEndsAt: toIsoString(state.awaitingEventEndsAt),
      currentOutcomeKey: state.currentOutcomeKey,
      noAnswerAttempts: state.noAnswerAttempts,
      lastDriverActionKey: state.lastDriverActionKey,
      lastDriverActionAt: toIsoString(state.lastDriverActionAt),
    }

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    console.error(`[engagement journey error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load engagement journey", code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
