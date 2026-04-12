import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export async function POST(request: Request) {
  const { householdName, memberIds, primaryMemberId } = await request.json()

  if (
    !householdName ||
    !Array.isArray(memberIds) ||
    memberIds.length === 0 ||
    !primaryMemberId ||
    !memberIds.includes(primaryMemberId)
  ) {
    return NextResponse.json({ error: "invalid household payload" }, { status: 400 })
  }

  try {
    const household = await db.household_group.create({
      data: {
        household_name: householdName,
        servicing_status: "active",
      },
    })

    await db.household_member.createMany({
      data: memberIds.map((memberId: string) => ({
        household_id: household.id,
        party_id: memberId,
        role_in_household: memberId === primaryMemberId ? "primary" : "member",
      })),
    })

    return NextResponse.json({ id: household.id })
  } catch (error) {
    console.error("[household create error]", error)
    return NextResponse.json({ error: "failed to create household" }, { status: 500 })
  }
}
