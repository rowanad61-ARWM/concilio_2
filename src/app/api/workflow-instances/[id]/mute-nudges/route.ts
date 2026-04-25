import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createJourneyTimelineEvent } from "@/lib/workflow"

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
  nudges_muted: boolean
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
    nudgesMuted: instance.nudges_muted,
    template: {
      id: instance.workflow_template.id,
      key: instance.workflow_template.key,
      name: instance.workflow_template.name,
      phaseOrder: instance.workflow_template.phase_order,
    },
  }
}

async function loadActorFromSession() {
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
      name: true,
      email: true,
    },
  })

  if (!actor) {
    return { error: NextResponse.json({ error: "signed-in user is not mapped to user_account" }, { status: 403 }) }
  }

  return { actor }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actorResult = await loadActorFromSession()
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

  if (typeof payload.muted !== "boolean") {
    return NextResponse.json({ error: "muted boolean is required" }, { status: 400 })
  }

  try {
    const existing = await db.workflow_instance.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        status: true,
        engagement: {
          select: {
            id: true,
            party_id: true,
            household_id: true,
            primary_adviser_id: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "workflow instance not found" }, { status: 404 })
    }

    if (existing.status === "completed" || existing.status === "cancelled") {
      return NextResponse.json({ error: "workflow instance is terminal" }, { status: 400 })
    }

    const now = new Date()
    const actorName = actorResult.actor.name || actorResult.actor.email
    const instance = await db.$transaction(async (tx) => {
      const updated = await tx.workflow_instance.update({
        where: {
          id,
        },
        data: {
          nudges_muted: payload.muted as boolean,
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

      await createJourneyTimelineEvent(tx, {
        engagementId: existing.engagement.id,
        partyId: existing.engagement.party_id,
        householdId: existing.engagement.household_id,
        primaryAdviserId: existing.engagement.primary_adviser_id,
        note: payload.muted ? `Nudges muted by ${actorName}` : `Nudges unmuted by ${actorName}`,
        at: now,
      })

      return updated
    })

    return NextResponse.json({ instance: toResponse(instance) })
  } catch (error) {
    console.error(`[workflow instance mute nudges error] ${id}`, error)
    return NextResponse.json({ error: "failed to update nudge mute state" }, { status: 500 })
  }
}
