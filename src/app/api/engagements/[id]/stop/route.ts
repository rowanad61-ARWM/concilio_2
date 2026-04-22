import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  AlreadyStoppedError,
  stopEngagementWorkflow,
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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
