import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { withAuditTrail } from "@/lib/audit-middleware"
import {
  InvalidOutcomeError,
  OutcomeTaskNotEligibleError,
  setOutcomeForWorkflowInstance,
  WorkflowCommunicationError,
  WorkflowEngagementNotFoundError,
  WorkflowInstanceNotFoundError,
} from "@/lib/workflow"
import {
  loadWorkflowInstanceSnapshot,
  responseJson,
  routeParamId,
  type IdRouteContext,
} from "@/lib/workflow-audit-snapshots"

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

type ActorIdResult = { actorId: string } | { error: Response }

async function loadActorIdFromSession(): Promise<ActorIdResult> {
  const session = await auth()
  if (!session) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  }

  const sessionEmail = session.user?.email?.trim().toLowerCase() ?? ""
  if (!sessionEmail) {
    return { error: NextResponse.json({ error: "session email missing" }, { status: 401 }) }
  }

  const actor = await db.user_account.findUnique({
    where: {
      email: sessionEmail,
    },
    select: {
      id: true,
    },
  })

  if (!actor) {
    return { error: NextResponse.json({ error: "signed-in user is not mapped to user_account" }, { status: 403 }) }
  }

  return { actorId: actor.id }
}

async function loadInstanceState(instanceId: string) {
  const instance = await db.workflow_instance.findUnique({
    where: {
      id: instanceId,
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
  })

  if (!instance) {
    return null
  }

  return {
    id: instance.id,
    engagementId: instance.engagement_id,
    status: instance.status,
    currentStage: instance.current_stage,
    triggerDate: instance.trigger_date.toISOString(),
    completedAt: toIsoString(instance.completed_at),
    currentOutcomeKey: instance.current_outcome_key,
    currentOutcomeSetAt: toIsoString(instance.current_outcome_set_at),
    noAnswerAttempts: instance.no_answer_attempts,
    lastDriverActionKey: instance.last_driver_action_key,
    lastDriverActionAt: toIsoString(instance.last_driver_action_at),
    template: {
      id: instance.workflow_template.id,
      key: instance.workflow_template.key,
      name: instance.workflow_template.name,
      phaseOrder: instance.workflow_template.phase_order,
    },
  }
}

async function setWorkflowInstanceOutcome(
  request: Request,
  { params }: IdRouteContext,
) {
  const actorResult = await loadActorIdFromSession()
  if ("error" in actorResult) {
    return actorResult.error
  }

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const outcomeKey = typeof payload.outcomeKey === "string" ? payload.outcomeKey.trim() : ""
  if (!outcomeKey) {
    return NextResponse.json({ error: "outcomeKey is required" }, { status: 400 })
  }

  try {
    const result = await setOutcomeForWorkflowInstance(id, outcomeKey, actorResult.actorId)
    const instance = await loadInstanceState(id)
    return NextResponse.json({ result, instance })
  } catch (error) {
    if (error instanceof WorkflowInstanceNotFoundError || error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    if (
      error instanceof InvalidOutcomeError ||
      error instanceof OutcomeTaskNotEligibleError ||
      error instanceof WorkflowCommunicationError
    ) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 400 })
    }

    console.error(`[workflow instance outcome error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to set workflow instance outcome" }, { status: 500 })
  }
}

export const POST = withAuditTrail<IdRouteContext>(
  setWorkflowInstanceOutcome,
  {
    entity_type: "workflow_instance",
    action: "OUTCOME_SET",
    beforeFn: async (_request, context) =>
      loadWorkflowInstanceSnapshot(await routeParamId(context)),
    afterFn: async (_request, context) =>
      loadWorkflowInstanceSnapshot(await routeParamId(context)),
    entityIdFn: async (_request, context) => routeParamId(context),
    metadataFn: async (_request, _context, auditContext) => {
      const payload = await responseJson<{
        result?: {
          effect?: unknown
          engagementId?: unknown
          targetPhase?: unknown
          attempts?: unknown
          spawnedTaskIdCreated?: unknown
          workflowStatus?: unknown
        }
        instance?: {
          currentOutcomeKey?: unknown
          engagementId?: unknown
          status?: unknown
        } | null
      }>(auditContext)

      return {
        effect:
          typeof payload?.result?.effect === "string" ? payload.result.effect : null,
        current_outcome_key:
          typeof payload?.instance?.currentOutcomeKey === "string"
            ? payload.instance.currentOutcomeKey
            : null,
        engagement_id:
          typeof payload?.result?.engagementId === "string"
            ? payload.result.engagementId
            : typeof payload?.instance?.engagementId === "string"
              ? payload.instance.engagementId
              : null,
        target_phase:
          typeof payload?.result?.targetPhase === "string"
            ? payload.result.targetPhase
            : null,
        attempts:
          typeof payload?.result?.attempts === "number"
            ? payload.result.attempts
            : null,
        spawned_task_id:
          typeof payload?.result?.spawnedTaskIdCreated === "string"
            ? payload.result.spawnedTaskIdCreated
            : null,
        workflow_status:
          typeof payload?.result?.workflowStatus === "string"
            ? payload.result.workflowStatus
            : typeof payload?.instance?.status === "string"
              ? payload.instance.status
              : null,
      }
    },
  },
)
