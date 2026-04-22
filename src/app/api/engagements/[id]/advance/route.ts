import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  advanceEngagementToNextPhase,
  InvalidTargetPhaseError,
  NoCurrentPhaseError,
  WorkflowEngagementNotFoundError,
} from "@/lib/workflow"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
