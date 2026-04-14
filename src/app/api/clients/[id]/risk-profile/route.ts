import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { allocationToRiskResult, scoreToAllocation, type RiskAllocation } from "@/lib/risk"

const RISK_ALLOCATIONS: RiskAllocation[] = ["30/70", "40/60", "50/50", "60/40", "70/30", "80/20", "100"]
const VALID_RISK_ALLOCATIONS = new Set<string>(RISK_ALLOCATIONS)
const VALID_CAPACITY_FOR_LOSS = new Set<string>(["low", "medium", "high"])

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const {
      score,
      capacityForLoss,
      validUntil,
      overrideFlag,
      overrideReason,
      overrideAllocation,
    } = await request.json()

    const numericScore = Number(score)
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      return NextResponse.json({ error: "score must be between 0 and 100" }, { status: 400 })
    }

    const normalizedScore = Math.round(numericScore)
    const normalizedCapacityForLoss = toNullableString(capacityForLoss)?.toLowerCase() ?? null
    if (normalizedCapacityForLoss && !VALID_CAPACITY_FOR_LOSS.has(normalizedCapacityForLoss)) {
      return NextResponse.json({ error: "invalid capacityForLoss" }, { status: 400 })
    }

    const isOverride = Boolean(overrideFlag)
    const normalizedOverrideReason = toNullableString(overrideReason)
    if (isOverride && !normalizedOverrideReason) {
      return NextResponse.json({ error: "overrideReason is required when overrideFlag is true" }, { status: 400 })
    }

    const normalizedOverrideAllocation = toNullableString(overrideAllocation)
    if (normalizedOverrideAllocation && !VALID_RISK_ALLOCATIONS.has(normalizedOverrideAllocation)) {
      return NextResponse.json({ error: "invalid overrideAllocation" }, { status: 400 })
    }

    const validUntilValue = toNullableString(validUntil)
    const parsedValidUntil = validUntilValue ? new Date(validUntilValue) : null
    if (validUntilValue && (!parsedValidUntil || Number.isNaN(parsedValidUntil.getTime()))) {
      return NextResponse.json({ error: "invalid validUntil" }, { status: 400 })
    }

    const derivedAllocation = scoreToAllocation(normalizedScore)
    const finalAllocation =
      isOverride && normalizedOverrideAllocation
        ? (normalizedOverrideAllocation as RiskAllocation)
        : derivedAllocation
    const riskResult = allocationToRiskResult(finalAllocation)

    const created = await db.risk_profile.create({
      data: {
        party_id: id,
        provider: "finametrica",
        risk_result: riskResult,
        score: normalizedScore,
        capacity_for_loss: normalizedCapacityForLoss,
        alignment_status: isOverride ? "overridden" : "aligned",
        override_flag: isOverride,
        override_reason: isOverride ? normalizedOverrideReason : null,
        completed_at: new Date(),
        valid_until: parsedValidUntil,
      },
    })

    return NextResponse.json({
      id: created.id,
      riskResult: created.risk_result,
      score: created.score,
      capacityForLoss: created.capacity_for_loss,
      overrideFlag: created.override_flag ?? false,
      overrideReason: created.override_reason,
      completedAt: created.completed_at?.toISOString() ?? null,
      validUntil: created.valid_until?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("[risk profile create error]", error)
    return NextResponse.json({ error: "failed to create risk profile" }, { status: 500 })
  }
}
