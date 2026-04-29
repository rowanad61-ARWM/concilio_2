import { NextResponse } from "next/server"

import {
  loadHouseholdSnapshot,
  responseId,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"

function valueFor(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key]
    }
  }

  return undefined
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null
}

async function createHousehold(request: Request) {
  const body = await request.json()
  const { householdName, memberIds, primaryMemberId } = body

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
        salutation_informal: nullableString(
          valueFor(body, ["salutation_informal", "salutationInformal"]),
        ),
        address_title_formal: nullableString(
          valueFor(body, ["address_title_formal", "addressTitleFormal"]),
        ),
        household_notes: nullableString(
          valueFor(body, ["household_notes", "householdNotes"]),
        ),
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

export const POST = withAuditTrail(createHousehold, {
  entity_type: "household_group",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseId(auditContext)
    return id ? loadHouseholdSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
})
