import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  InvalidOutcomeError,
  OutcomeAlreadySetError,
  OutcomeTaskNotEligibleError,
  setOutcomeForSpawnedTask,
  SpawnedTaskNotFoundError,
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

  const sessionEmail = session.user?.email?.trim().toLowerCase() ?? ""
  if (!sessionEmail) {
    return NextResponse.json({ error: "session email missing" }, { status: 401 })
  }

  try {
    const actor = await db.user_account.findUnique({
      where: {
        email: sessionEmail,
      },
      select: {
        id: true,
      },
    })

    if (!actor) {
      return NextResponse.json({ error: "signed-in user is not mapped to user_account" }, { status: 403 })
    }

    const spawnedTask = await db.workflow_spawned_task.findFirst({
      where: {
        task_id: id,
      },
      select: {
        id: true,
      },
    })

    if (!spawnedTask) {
      return NextResponse.json({ error: "task is not linked to a workflow spawned task" }, { status: 404 })
    }

    const result = await setOutcomeForSpawnedTask(spawnedTask.id, outcomeKey, actor.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SpawnedTaskNotFoundError || error instanceof WorkflowEngagementNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 404 })
    }

    if (error instanceof InvalidOutcomeError || error instanceof OutcomeTaskNotEligibleError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 400 })
    }

    if (error instanceof OutcomeAlreadySetError) {
      return NextResponse.json({ error: error.message, code: error.name }, { status: 409 })
    }

    console.error(`[task outcome set error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to set task outcome" }, { status: 500 })
  }
}
