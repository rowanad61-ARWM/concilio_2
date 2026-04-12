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

    if (lifecycleStage !== undefined) {
      const membership = await db.household_member.findFirst({
        where: {
          party_id: id,
          end_date: null,
        },
        select: {
          household_id: true,
        },
      })

      if (membership) {
        const otherMembers = await db.household_member.findMany({
          where: {
            household_id: membership.household_id,
            party_id: {
              not: id,
            },
            end_date: null,
          },
          select: {
            party_id: true,
          },
        })

        const otherPartyIds = [...new Set(otherMembers.map((member) => member.party_id))]

        await Promise.all(
          otherPartyIds.map(async (partyId) => {
            const existingMemberClassification = await db.client_classification.findUnique({
              where: { party_id: partyId },
            })

            if (existingMemberClassification) {
              await db.client_classification.update({
                where: { party_id: partyId },
                data: {
                  lifecycle_stage: classification.lifecycle_stage,
                },
              })
            } else {
              await db.client_classification.create({
                data: {
                  party_id: partyId,
                  lifecycle_stage: classification.lifecycle_stage,
                },
              })
            }
          }),
        )
      }
    }

    if (serviceTier !== undefined) {
      const membership = await db.household_member.findFirst({
        where: {
          party_id: id,
          end_date: null,
        },
        select: {
          household_id: true,
        },
      })

      if (membership) {
        const otherMembers = await db.household_member.findMany({
          where: {
            household_id: membership.household_id,
            party_id: {
              not: id,
            },
            end_date: null,
          },
          select: {
            party_id: true,
          },
        })

        const otherPartyIds = [...new Set(otherMembers.map((member) => member.party_id))]

        await Promise.all(
          otherPartyIds.map(async (partyId) => {
            const existingMemberClassification = await db.client_classification.findUnique({
              where: { party_id: partyId },
            })

            if (existingMemberClassification) {
              await db.client_classification.update({
                where: { party_id: partyId },
                data: {
                  service_tier: classification.service_tier,
                },
              })
            } else {
              await db.client_classification.create({
                data: {
                  party_id: partyId,
                  service_tier: classification.service_tier,
                },
              })
            }
          }),
        )
      }
    }

    return NextResponse.json(classification)
  } catch (error) {
    console.error("[classification update error]", error)
    return NextResponse.json({ error: "failed to update classification" }, { status: 500 })
  }
}
