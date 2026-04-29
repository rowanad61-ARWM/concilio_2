import { NextResponse } from "next/server"

import { loadHouseholdMemberSnapshot } from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS,
  CHECK_CONSTRAINED_PERSON_FIELDS,
  coerceEmptyToNull,
} from "@/lib/input-coercion"

type HouseholdMemberRouteContext = {
  params: Promise<{ id: string; memberId: string }>
}

const VALID_DEPENDANT_RELATIONS = new Set([
  "child",
  "step_child",
  "foster_child",
  "parent",
  "sibling",
  "other",
])

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

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value)
  if (!text) {
    return null
  }

  const date = new Date(text)
  return Number.isNaN(date.valueOf()) ? null : date
}

function integerValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : fallback
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off", ""].includes(normalized)) return false
  }

  return fallback
}

function buildPersonUpdateData(body: Record<string, unknown>) {
  const personData: Record<string, unknown> = {}

  assignIfPresent(personData, "title", body, ["title"])
  assignIfPresent(personData, "initials", body, ["initials"])
  assignIfPresent(personData, "legal_given_name", body, [
    "legal_given_name",
    "legalGivenName",
    "firstName",
  ])
  assignIfPresent(personData, "legal_middle_names", body, [
    "legal_middle_names",
    "legalMiddleNames",
    "middleNames",
  ])
  assignIfPresent(personData, "legal_family_name", body, [
    "legal_family_name",
    "legalFamilyName",
    "lastName",
  ])
  assignIfPresent(personData, "preferred_name", body, ["preferred_name", "preferredName"])
  assignIfPresent(personData, "previous_names", body, ["previous_names", "previousNames"])
  assignIfPresent(personData, "maiden_name", body, ["maiden_name", "maidenName"])
  assignIfPresent(personData, "mothers_maiden_name", body, [
    "mothers_maiden_name",
    "mothersMaidenName",
  ])
  assignIfPresent(personData, "gender", body, ["gender"])
  assignIfPresent(personData, "gender_pronouns", body, ["gender_pronouns", "genderPronouns"])
  assignIfPresent(personData, "place_of_birth", body, ["place_of_birth", "placeOfBirth"])
  assignIfPresent(personData, "country_of_birth", body, ["country_of_birth", "countryOfBirth"])
  assignIfPresent(personData, "mobile_phone", body, ["mobile_phone", "mobilePhone", "mobile"])
  assignIfPresent(personData, "email_primary", body, ["email_primary", "emailPrimary", "email"])
  assignIfPresent(personData, "email_alternate", body, ["email_alternate", "emailAlternate"])
  assignIfPresent(personData, "country_of_residence", body, [
    "country_of_residence",
    "countryOfResidence",
  ])
  assignIfPresent(personData, "resident_status", body, ["resident_status", "residentStatus"])
  assignIfPresent(personData, "country_of_tax_residency", body, [
    "country_of_tax_residency",
    "countryOfTaxResidency",
  ])
  assignIfPresent(personData, "tax_resident_status", body, [
    "tax_resident_status",
    "taxResidentStatus",
  ])
  assignIfPresent(personData, "relationship_status", body, [
    "relationship_status",
    "relationshipStatus",
  ])
  assignIfPresent(personData, "pep_notes", body, ["pep_notes", "pepNotes"])

  if (hasAnyProperty(body, ["date_of_birth", "dateOfBirth"])) {
    const parsedDate = dateValue(valueFor(body, ["date_of_birth", "dateOfBirth"]))
    if (!parsedDate) {
      return { error: "invalid date_of_birth" }
    }
    personData.date_of_birth = parsedDate
  }

  if (hasAnyProperty(body, ["is_pep_risk", "isPepRisk"])) {
    personData.is_pep_risk = booleanValue(valueFor(body, ["is_pep_risk", "isPepRisk"]))
  }

  return {
    data: coerceEmptyToNull(personData, CHECK_CONSTRAINED_PERSON_FIELDS),
  }
}

async function updateHouseholdMember(
  request: Request,
  { params }: HouseholdMemberRouteContext,
) {
  const { id: householdId, memberId } = await params
  const body = (await request.json()) as Record<string, unknown>

  try {
    const existing = await db.household_member.findFirst({
      where: {
        id: memberId,
        household_id: householdId,
      },
      include: {
        party: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "household member not found" }, { status: 404 })
    }

    const memberInput = coerceEmptyToNull(
      {
        role_in_household: valueFor(body, ["role_in_household", "roleInHousehold"]),
        relation: valueFor(body, ["relation"]),
      },
      CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS,
    )
    const memberData: Record<string, unknown> = {}

    if (hasAnyProperty(body, ["role_in_household", "roleInHousehold"])) {
      const role = stringValue(memberInput.role_in_household)
      if (!role) {
        return NextResponse.json({ error: "role_in_household is required" }, { status: 400 })
      }
      memberData.role_in_household = role
    }

    const resolvedRole =
      typeof memberData.role_in_household === "string"
        ? memberData.role_in_household
        : existing.role_in_household
    const isDependant = resolvedRole === "dependant"

    if (isDependant) {
      if (hasAnyProperty(body, ["is_financial_dependant", "isFinancialDependant"])) {
        memberData.is_financial_dependant = booleanValue(
          valueFor(body, ["is_financial_dependant", "isFinancialDependant"]),
        )
      }

      if (hasAnyProperty(body, ["dependant_until_age", "dependantUntilAge"])) {
        memberData.dependant_until_age = integerValue(
          valueFor(body, ["dependant_until_age", "dependantUntilAge"]),
        )
      }

      if (hasAnyProperty(body, ["relation"])) {
        const relation = stringValue(memberInput.relation)
        if (relation && !VALID_DEPENDANT_RELATIONS.has(relation)) {
          return NextResponse.json({ error: "invalid relation" }, { status: 400 })
        }
        memberData.relation = relation
      }

      assignIfPresent(memberData, "relation_to_member_id", body, [
        "relation_to_member_id",
        "relationToMemberId",
      ])
      assignIfPresent(memberData, "dependant_notes", body, [
        "dependant_notes",
        "dependantNotes",
      ])
    }

    const personResult = buildPersonUpdateData(body)
    if ("error" in personResult) {
      return NextResponse.json({ error: personResult.error }, { status: 400 })
    }

    const personData = personResult.data

    const updated = await db.$transaction(async (tx) => {
      if (Object.keys(memberData).length > 0) {
        await tx.household_member.update({
          where: { id: memberId },
          data: memberData,
        })
      }

      if (Object.keys(personData).length > 0) {
        await tx.person.update({
          where: { id: existing.party_id },
          data: personData,
        })

        const given =
          typeof personData.legal_given_name === "string"
            ? personData.legal_given_name
            : existing.party.person?.legal_given_name
        const family =
          typeof personData.legal_family_name === "string"
            ? personData.legal_family_name
            : existing.party.person?.legal_family_name

        if (given && family) {
          await tx.party.update({
            where: { id: existing.party_id },
            data: {
              display_name: `${given} ${family}`.trim(),
            },
          })
        }
      }

      return tx.household_member.findUnique({
        where: { id: memberId },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[household member update error]", error)
    return NextResponse.json({ error: "failed to update household member" }, { status: 500 })
  }
}

async function deleteHouseholdMember(
  request: Request,
  { params }: HouseholdMemberRouteContext,
) {
  const { id: householdId, memberId } = await params
  const hardDelete = new URL(request.url).searchParams.get("hard") === "true"

  try {
    const existing = await db.household_member.findFirst({
      where: {
        id: memberId,
        household_id: householdId,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "household member not found" }, { status: 404 })
    }

    if (hardDelete) {
      const dependantReferences = await db.household_member.count({
        where: {
          relation_to_member_id: memberId,
        },
      })

      if (dependantReferences > 0) {
        return NextResponse.json(
          { error: "household member has dependant references" },
          { status: 409 },
        )
      }

      await db.household_member.delete({
        where: { id: memberId },
      })

      return NextResponse.json({ id: memberId, hardDeleted: true })
    }

    const updated = await db.household_member.update({
      where: { id: memberId },
      data: {
        end_date: new Date(),
      },
    })

    return NextResponse.json({
      id: memberId,
      softDeleted: true,
      end_date: updated.end_date,
    })
  } catch (error) {
    console.error("[household member delete error]", error)
    return NextResponse.json({ error: "failed to delete household member" }, { status: 500 })
  }
}

export const PATCH = withAuditTrail<HouseholdMemberRouteContext>(updateHouseholdMember, {
  entity_type: "household_member",
  action: "UPDATE",
  beforeFn: async (_request, context) => {
    const { memberId } = await context.params
    return loadHouseholdMemberSnapshot(memberId)
  },
  afterFn: async (_request, context) => {
    const { memberId } = await context.params
    return loadHouseholdMemberSnapshot(memberId)
  },
  entityIdFn: async (_request, context) => {
    const { memberId } = await context.params
    return memberId
  },
})

export const DELETE = withAuditTrail<HouseholdMemberRouteContext>(deleteHouseholdMember, {
  entity_type: "household_member",
  action: "DELETE",
  beforeFn: async (_request, context) => {
    const { memberId } = await context.params
    return loadHouseholdMemberSnapshot(memberId)
  },
  afterFn: async (_request, context) => {
    const { memberId } = await context.params
    return loadHouseholdMemberSnapshot(memberId)
  },
  entityIdFn: async (_request, context) => {
    const { memberId } = await context.params
    return memberId
  },
})
