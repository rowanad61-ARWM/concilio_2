import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  advanceEngagementToNextPhase,
  InvalidTargetPhaseError,
  NoCurrentPhaseError,
  WorkflowEngagementNotFoundError,
} from "@/lib/workflow"
import { withAuditTrail } from "@/lib/audit-middleware"
import {
  loadEngagementSnapshot,
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

async function advanceEngagement(
  request: Request,
  { params }: IdRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let payload: { targetPhaseKey?: string } = {}

  try {
    const rawBody = await request.text()
    if (rawBody.trim()) {
      payload = JSON.parse(rawBody) as { targetPhaseKey?: string }
    }
  } catch {
    return NextResponse.json({ error: "invalid json body", code: "INVALID_JSON" }, { status: 400 })
  }

  try {
    const result = await advanceEngagementToNextPhase(id, {
      targetPhaseKey: typeof payload.targetPhaseKey === "string" ? payload.targetPhaseKey : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    if (error instanceof NoCurrentPhaseError || error instanceof InvalidTargetPhaseError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 400 })
    }

    console.error(`[engagement advance error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to advance engagement journey", code: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export const POST = withAuditTrail<IdRouteContext>(advanceEngagement, {
  entity_type: "engagement",
  action: "WORKFLOW_ADVANCED",
  beforeFn: async (_request, context) =>
    loadEngagementSnapshot(await routeParamId(context)),
  afterFn: async (_request, context) =>
    loadEngagementSnapshot(await routeParamId(context)),
  entityIdFn: async (_request, context) => routeParamId(context),
  metadataFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<{
      closedInstance?: { id?: unknown } | null
      newInstance?: { id?: unknown } | null
      lifecycleStage?: unknown
      atEndOfChain?: unknown
    }>(auditContext)

    return {
      closed_instance_id:
        typeof payload?.closedInstance?.id === "string"
          ? payload.closedInstance.id
          : null,
      spawned_instance_id:
        typeof payload?.newInstance?.id === "string" ? payload.newInstance.id : null,
      lifecycle_stage:
        typeof payload?.lifecycleStage === "string" ? payload.lifecycleStage : null,
      at_end_of_chain:
        typeof payload?.atEndOfChain === "boolean" ? payload.atEndOfChain : null,
    }
  },
})
