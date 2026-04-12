import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const { lifecycleStage, serviceTier } = await request.json()

    const updateData: {
      lifecycle_stage?: string | null
      service_tier?: string | null
    } = {}

    if (lifecycleStage !== undefined) {
      updateData.lifecycle_stage = lifecycleStage
    }

    if (serviceTier !== undefined) {
      updateData.service_tier = serviceTier
    }

    const existing = await db.client_classification.findUnique({
      where: { party_id: id },
    })

    const classification = existing
      ? await db.client_classification.update({
          where: { party_id: id },
          data: updateData,
        })
      : await db.client_classification.create({
          data: {
            party_id: id,
            ...updateData,
          },
        })

    return NextResponse.json(classification)
  } catch (error) {
    console.error("[classification update error]", error)
    return NextResponse.json({ error: "failed to update classification" }, { status: 500 })
  }
}
