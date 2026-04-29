import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import {
  loadHouseholdMemberSnapshot,
  responseId,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS,
  CHECK_CONSTRAINED_PERSON_FIELDS,
  coerceEmptyToNull,
} from "@/lib/input-coercion"

type HouseholdMembersRouteContext = { params: Promise<{ id: string }> }

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

function buildPersonCreateData(partyId: string, body: Record<string, unknown>) {
  const legalGivenName = stringValue(
    valueFor(body, ["legal_given_name", "legalGivenName", "firstName"]),
  )
  const legalFamilyName = stringValue(
    valueFor(body, ["legal_family_name", "legalFamilyName", "lastName"]),
  )
  const dateOfBirth = dateValue(valueFor(body, ["date_of_birth", "dateOfBirth"]))

  if (!legalGivenName || !legalFamilyName || !dateOfBirth) {
    return null
  }

  const personData: Record<string, unknown> = {
    id: partyId,
    legal_given_name: legalGivenName,
    legal_family_name: legalFamilyName,
    date_of_birth: dateOfBirth,
    citizenships: Array.isArray(body.citizenships) ? body.citizenships : [],
  }

  assignIfPresent(personData, "title", body, ["title"])
  assignIfPresent(personData, "initials", body, ["initials"])
  assignIfPresent(personData, "legal_middle_names", body, [
    "legal_middle_names",
    "legalMiddleNames",
    "middleNames",
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

  if (hasAnyProperty(body, ["is_pep_risk", "isPepRisk"])) {
    personData.is_pep_risk = booleanValue(valueFor(body, ["is_pep_risk", "isPepRisk"]))
  }

  return coerceEmptyToNull(personData, CHECK_CONSTRAINED_PERSON_FIELDS)
}

async function createHouseholdMember(
  request: Request,
  { params }: HouseholdMembersRouteContext,
) {
  const { id: householdId } = await params
  const body = (await request.json()) as Record<string, unknown>

  const memberInput = coerceEmptyToNull(
    {
      role_in_household: valueFor(body, ["role_in_household", "roleInHousehold"]),
      relation: valueFor(body, ["relation"]),
    },
    CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS,
  )

  const role = stringValue(memberInput.role_in_household)
  if (!role) {
    return NextResponse.json({ error: "role_in_household is required" }, { status: 400 })
  }

  const personData = buildPersonCreateData("", body)
  if (!personData) {
    return NextResponse.json(
      { error: "legal_given_name, legal_family_name and date_of_birth are required" },
      { status: 400 },
    )
  }

  const isDependant = role === "dependant"
  const relation = stringValue(memberInput.relation)

  if (isDependant && relation && !VALID_DEPENDANT_RELATIONS.has(relation)) {
    return NextResponse.json({ error: "invalid relation" }, { status: 400 })
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const household = await tx.household_group.findUnique({
        where: { id: householdId },
        select: { id: true },
      })

      if (!household) {
        return null
      }

      const legalGivenName = personData.legal_given_name as string
      const legalFamilyName = personData.legal_family_name as string

      const party = await tx.party.create({
        data: {
          party_type: "person",
          display_name: `${legalGivenName} ${legalFamilyName}`.trim(),
          status: "active",
        },
      })

      await tx.person.create({
        data: {
          ...personData,
          id: party.id,
        } as Prisma.personUncheckedCreateInput,
      })

      const memberData: Record<string, unknown> = {
        household_id: householdId,
        party_id: party.id,
        role_in_household: role,
      }

      if (isDependant) {
        memberData.is_financial_dependant = booleanValue(
          valueFor(body, ["is_financial_dependant", "isFinancialDependant"]),
        )
        memberData.dependant_until_age = integerValue(
          valueFor(body, ["dependant_until_age", "dependantUntilAge"]),
        )
        memberData.relation = relation
        memberData.relation_to_member_id =
          stringValue(valueFor(body, ["relation_to_member_id", "relationToMemberId"])) ??
          null
        memberData.dependant_notes =
          valueFor(body, ["dependant_notes", "dependantNotes"]) ?? null
      }

      const member = await tx.household_member.create({
        data: memberData as Prisma.household_memberUncheckedCreateInput,
      })

      return {
        id: member.id,
        householdId,
        partyId: party.id,
        personId: party.id,
      }
    })

    if (!created) {
      return NextResponse.json({ error: "household not found" }, { status: 404 })
    }

    return NextResponse.json(created)
  } catch (error) {
    console.error("[household member create error]", error)
    return NextResponse.json({ error: "failed to create household member" }, { status: 500 })
  }
}

export const POST = withAuditTrail<HouseholdMembersRouteContext>(createHouseholdMember, {
  entity_type: "household_member",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseId(auditContext)
    return id ? loadHouseholdMemberSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
  metadataFn: async (_request, context, auditContext) => {
    const { id: householdId } = await context.params
    const payload = await auditContext.response?.clone().json().catch(() => null)

    return {
      household_id: householdId,
      party_id:
        payload && typeof payload.partyId === "string" ? payload.partyId : null,
    }
  },
})
