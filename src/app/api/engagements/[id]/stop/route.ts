import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  AlreadyStoppedError,
  stopEngagementWorkflow,
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

async function stopEngagement(
  _request: Request,
  { params }: IdRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const result = await stopEngagementWorkflow(id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    if (error instanceof AlreadyStoppedError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 400 })
    }

    console.error(`[engagement stop error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to stop engagement journey", code: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export const POST = withAuditTrail<IdRouteContext>(stopEngagement, {
  entity_type: "engagement",
  action: "WORKFLOW_STOPPED",
  beforeFn: async (_request, context) =>
    loadEngagementSnapshot(await routeParamId(context)),
  afterFn: async (_request, context) =>
    loadEngagementSnapshot(await routeParamId(context)),
  entityIdFn: async (_request, context) => routeParamId(context),
  metadataFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<{
      closedInstance?: { id?: unknown } | null
      closingInstance?: { id?: unknown } | null
      terminalStage?: unknown
    }>(auditContext)

    return {
      closed_instance_id:
        typeof payload?.closedInstance?.id === "string"
          ? payload.closedInstance.id
          : null,
      spawned_instance_id:
        typeof payload?.closingInstance?.id === "string"
          ? payload.closingInstance.id
          : null,
      terminal_stage:
        typeof payload?.terminalStage === "string" ? payload.terminalStage : null,
    }
  },
})
