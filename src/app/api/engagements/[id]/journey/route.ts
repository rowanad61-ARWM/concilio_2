import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getJourneyState, WorkflowEngagementNotFoundError } from "@/lib/workflow"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
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
    return NextResponse.json(state)
  } catch (error) {
    if (error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    console.error(`[engagement journey error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load engagement journey", code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
