import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { withAuditTrail } from "@/lib/audit-middleware"
import {
  loadWorkflowInstanceSnapshot,
  responseJson,
  routeParamId,
  type IdRouteContext,
} from "@/lib/workflow-audit-snapshots"

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function toResponse(instance: {
  id: string
  engagement_id: string
  status: string
  current_stage: string
  trigger_date: Date
  completed_at: Date | null
  current_outcome_key: string | null
  current_outcome_set_at: Date | null
  no_answer_attempts: number
  last_driver_action_key: string | null
  last_driver_action_at: Date | null
  workflow_template: {
    id: string
    key: string
    name: string
    phase_order: number | null
  }
}) {
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

async function resumeWorkflowInstance(
  _request: Request,
  { params }: IdRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await db.workflow_instance.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "workflow instance not found" }, { status: 404 })
    }

    if (existing.status === "completed" || existing.status === "cancelled") {
      return NextResponse.json({ error: "workflow instance is terminal" }, { status: 400 })
    }

    const now = new Date()
    const instance = await db.workflow_instance.update({
      where: {
        id,
      },
      data: {
        status: "active",
        current_outcome_key: null,
        current_outcome_set_at: null,
        last_event_at: now,
        updated_at: now,
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

    return NextResponse.json({ instance: toResponse(instance) })
  } catch (error) {
    console.error(`[workflow instance resume error] ${id}`, error)
    return NextResponse.json({ error: "failed to resume workflow instance" }, { status: 500 })
  }
}

export const POST = withAuditTrail<IdRouteContext>(resumeWorkflowInstance, {
  entity_type: "workflow_instance",
  action: "UPDATE",
  beforeFn: async (_request, context) =>
    loadWorkflowInstanceSnapshot(await routeParamId(context)),
  afterFn: async (_request, context) =>
    loadWorkflowInstanceSnapshot(await routeParamId(context)),
  entityIdFn: async (_request, context) => routeParamId(context),
  metadataFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<{
      instance?: {
        engagementId?: unknown
        status?: unknown
        currentOutcomeKey?: unknown
      }
    }>(auditContext)

    return {
      engagement_id:
        typeof payload?.instance?.engagementId === "string"
          ? payload.instance.engagementId
          : null,
      status:
        typeof payload?.instance?.status === "string" ? payload.instance.status : null,
      current_outcome_key:
        typeof payload?.instance?.currentOutcomeKey === "string"
          ? payload.instance.currentOutcomeKey
          : null,
    }
  },
})
