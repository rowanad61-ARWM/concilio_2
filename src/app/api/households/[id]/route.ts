import { NextResponse } from "next/server"

import { loadHouseholdSnapshot } from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"

type HouseholdRouteContext = { params: Promise<{ id: string }> }

function hasAnyProperty(source: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key))
}

function valueFor(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key]
    }
  }

  return undefined
}

function assignIfPresent(
  target: Record<string, unknown>,
  column: string,
  source: Record<string, unknown>,
  keys: string[],
) {
  if (hasAnyProperty(source, keys)) {
    target[column] = valueFor(source, keys) ?? null
  }
}

async function updateHousehold(
  request: Request,
  { params }: HouseholdRouteContext,
) {
  const { id } = await params
  const body = await request.json()
  const updateData: Record<string, unknown> = {}

  assignIfPresent(updateData, "salutation_informal", body, [
    "salutation_informal",
    "salutationInformal",
  ])
  assignIfPresent(updateData, "address_title_formal", body, [
    "address_title_formal",
    "addressTitleFormal",
  ])
  assignIfPresent(updateData, "household_notes", body, [
    "household_notes",
    "householdNotes",
  ])

  try {
    const existing = await db.household_group.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "household not found" }, { status: 404 })
    }

    const household = await db.household_group.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(household)
  } catch (error) {
    console.error("[household update error]", error)
    return NextResponse.json({ error: "failed to update household" }, { status: 500 })
  }
}

export const PATCH = withAuditTrail<HouseholdRouteContext>(updateHousehold, {
  entity_type: "household_group",
  action: "UPDATE",
  beforeFn: async (_request, context) => {
    const { id } = await context.params
    return loadHouseholdSnapshot(id)
  },
  afterFn: async (_request, context) => {
    const { id } = await context.params
    return loadHouseholdSnapshot(id)
  },
  entityIdFn: async (_request, context) => {
    const { id } = await context.params
    return id
  },
})
