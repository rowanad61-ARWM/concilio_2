import { NextResponse } from "next/server"

import { db } from "@/lib/db"

function extractStageKeys(stages: unknown) {
  if (!Array.isArray(stages)) {
    return []
  }

  return stages
    .map((stage) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return null
      }

      const key = (stage as Record<string, unknown>).key
      return typeof key === "string" && key.trim() ? key.trim() : null
    })
    .filter((value): value is string => Boolean(value))
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const instance = await db.workflow_instance.findUnique({
      where: { id },
      include: {
        workflow_template: true,
      },
    })

    if (!instance) {
      return NextResponse.json({ error: "workflow instance not found" }, { status: 404 })
    }

    const stageKeys = extractStageKeys(instance.workflow_template.stages)
    if (stageKeys.length === 0) {
      return NextResponse.json({ error: "workflow template has no stages" }, { status: 400 })
    }

    if (instance.status === "completed") {
      return NextResponse.json({
        id: instance.id,
        currentStage: instance.current_stage,
        status: instance.status,
        completedAt: instance.completed_at?.toISOString() ?? null,
        lastEventAt: instance.last_event_at?.toISOString() ?? null,
      })
    }

    const now = new Date()
    const currentIndex = stageKeys.findIndex((key) => key === instance.current_stage)
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0

    if (safeCurrentIndex >= stageKeys.length - 1) {
      const completedInstance = await db.workflow_instance.update({
        where: { id: instance.id },
        data: {
          status: "completed",
          completed_at: now,
          last_event_at: now,
          updated_at: now,
        },
      })

      return NextResponse.json({
        id: completedInstance.id,
        currentStage: completedInstance.current_stage,
        status: completedInstance.status,
        completedAt: completedInstance.completed_at?.toISOString() ?? null,
        lastEventAt: completedInstance.last_event_at?.toISOString() ?? null,
      })
    }

    const nextStage = stageKeys[safeCurrentIndex + 1]
    const advancedInstance = await db.workflow_instance.update({
      where: { id: instance.id },
      data: {
        current_stage: nextStage,
        status: "active",
        last_event_at: now,
        updated_at: now,
      },
    })

    return NextResponse.json({
      id: advancedInstance.id,
      currentStage: advancedInstance.current_stage,
      status: advancedInstance.status,
      completedAt: advancedInstance.completed_at?.toISOString() ?? null,
      lastEventAt: advancedInstance.last_event_at?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("[workflow instance advance error]", error)
    return NextResponse.json({ error: "failed to advance workflow stage" }, { status: 500 })
  }
}

