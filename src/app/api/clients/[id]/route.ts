import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  loadClientParentSnapshot,
  loadClientRecordSnapshot,
  responseJson,
  routeParamId,
  type ClientRouteContext,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  CHECK_CONSTRAINED_EMPLOYMENT_PROFILE_FIELDS,
  CHECK_CONSTRAINED_PARTY_FIELDS,
  CHECK_CONSTRAINED_PERSON_FIELDS,
  coerceEmptyToNull,
} from "@/lib/input-coercion"
import { hardDeleteParty, PartyDeleteBlockedError, PartyNotFoundError } from "@/lib/partyDelete"

type ColumnRow = {
  column_name: string
}

type ConstraintRow = {
  definition: string
}

function extractConstraintValues(definition: string) {
  const matches = definition.matchAll(/'([^']+)'/g)
  const values = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      values.add(match[1])
    }
  }

  return [...values]
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

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

function assignLimitedStringIfPresent(
  target: Record<string, unknown>,
  column: string,
  source: Record<string, unknown>,
  keys: string[],
  maxLength: number,
) {
  if (!hasAnyProperty(source, keys)) {
    return null
  }

  const value = valueFor(source, keys)
  if (value === null || value === undefined || value === "") {
    target[column] = null
    return null
  }

  if (typeof value !== "string") {
    return `${column} must be a string`
  }

  const trimmed = value.trim()
  if (!trimmed) {
    target[column] = null
    return null
  }

  if (trimmed.length > maxLength) {
    return `${column} must be ${maxLength} characters or fewer`
  }

  target[column] = trimmed
  return null
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off", ""].includes(normalized)) return false
  }

  return null
}

function optionalDateValue(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? "invalid" : value
  }

  if (typeof value !== "string") {
    return "invalid"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? "invalid" : parsed
}

async function getEmploymentColumns() {
  const rows = await db.$queryRawUnsafe<ColumnRow[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'employment_profile'`,
  )

  return new Set(rows.map((row) => row.column_name))
}

async function getEmploymentStatusOptions() {
  const rows = await db.$queryRawUnsafe<ConstraintRow[]>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'employment_profile'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%employment_status%'`,
  )

  return rows.flatMap((row) => extractConstraintValues(row.definition))
}

async function updateClient(
  request: Request,
  { params }: ClientRouteContext,
) {
  const { id } = await params

  try {
    const existingPerson = await db.person.findUnique({
      where: { id },
    })

    if (!existingPerson) {
      return NextResponse.json({ error: "person not found" }, { status: 404 })
    }

    const payload = await request.json()

    const {
      firstName,
      lastName,
      dateOfBirth,
      addressResidential,
      addressPostal,
    } = payload

    const hasAddressResidential = Object.prototype.hasOwnProperty.call(payload, "addressResidential")
    const hasAddressPostal = Object.prototype.hasOwnProperty.call(payload, "addressPostal")
    const hasEmploymentStatus = Object.prototype.hasOwnProperty.call(payload, "employmentStatus")
    const hasEmployerName = Object.prototype.hasOwnProperty.call(payload, "employerName")
    const hasOccupation = Object.prototype.hasOwnProperty.call(payload, "occupation")
    const hasIndustry = Object.prototype.hasOwnProperty.call(payload, "industry")
    const hasEmploymentType = Object.prototype.hasOwnProperty.call(payload, "employmentType")
    const hasEmploymentPayload =
      hasEmploymentStatus || hasEmployerName || hasOccupation || hasIndustry || hasEmploymentType

    const personPayload: Record<string, unknown> = payload
    const personUpdateData: Record<string, unknown> = {
      legal_given_name: firstName ?? existingPerson.legal_given_name,
      legal_family_name: lastName ?? existingPerson.legal_family_name,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : existingPerson.date_of_birth,
      ...(hasAddressResidential ? { address_residential: addressResidential } : {}),
      ...(hasAddressPostal ? { address_postal: addressPostal } : {}),
    }

    assignIfPresent(personUpdateData, "preferred_name", personPayload, [
      "preferred_name",
      "preferredName",
    ])
    assignIfPresent(personUpdateData, "email_primary", personPayload, [
      "email_primary",
      "emailPrimary",
      "email",
    ])
    assignIfPresent(personUpdateData, "mobile_phone", personPayload, [
      "mobile_phone",
      "mobilePhone",
      "mobile",
    ])
    assignIfPresent(personUpdateData, "relationship_status", personPayload, [
      "relationship_status",
      "relationshipStatus",
    ])
    assignIfPresent(personUpdateData, "country_of_residence", personPayload, [
      "country_of_residence",
      "countryOfResidence",
    ])
    assignIfPresent(personUpdateData, "title", personPayload, ["title"])
    assignIfPresent(personUpdateData, "initials", personPayload, ["initials"])
    assignIfPresent(personUpdateData, "legal_middle_names", personPayload, [
      "legal_middle_names",
      "legalMiddleNames",
      "middleNames",
    ])
    assignIfPresent(personUpdateData, "maiden_name", personPayload, ["maiden_name", "maidenName"])
    assignIfPresent(personUpdateData, "mothers_maiden_name", personPayload, [
      "mothers_maiden_name",
      "mothersMaidenName",
    ])
    assignIfPresent(personUpdateData, "gender", personPayload, ["gender"])
    assignIfPresent(personUpdateData, "gender_pronouns", personPayload, [
      "gender_pronouns",
      "genderPronouns",
    ])
    assignIfPresent(personUpdateData, "place_of_birth", personPayload, [
      "place_of_birth",
      "placeOfBirth",
    ])
    assignIfPresent(personUpdateData, "country_of_birth", personPayload, [
      "country_of_birth",
      "countryOfBirth",
    ])
    assignIfPresent(personUpdateData, "resident_status", personPayload, [
      "resident_status",
      "residentStatus",
    ])
    assignIfPresent(personUpdateData, "country_of_tax_residency", personPayload, [
      "country_of_tax_residency",
      "countryOfTaxResidency",
    ])
    assignIfPresent(personUpdateData, "tax_resident_status", personPayload, [
      "tax_resident_status",
      "taxResidentStatus",
    ])
    assignIfPresent(personUpdateData, "pep_notes", personPayload, ["pep_notes", "pepNotes"])
    assignIfPresent(personUpdateData, "will_location", personPayload, [
      "will_location",
      "willLocation",
    ])
    assignIfPresent(personUpdateData, "estate_planning_notes", personPayload, [
      "estate_planning_notes",
      "estatePlanningNotes",
    ])
    assignIfPresent(personUpdateData, "funeral_plan_status", personPayload, [
      "funeral_plan_status",
      "funeralPlanStatus",
    ])
    assignIfPresent(personUpdateData, "preferred_contact_method", personPayload, [
      "preferred_contact_method",
      "preferredContactMethod",
    ])

    const limitedTextError =
      assignLimitedStringIfPresent(personUpdateData, "email_alternate", personPayload, [
        "email_alternate",
        "emailAlternate",
      ], 200) ??
      assignLimitedStringIfPresent(personUpdateData, "emergency_contact_name", personPayload, [
        "emergency_contact_name",
        "emergencyContactName",
      ], 200) ??
      assignLimitedStringIfPresent(personUpdateData, "emergency_contact_relationship", personPayload, [
        "emergency_contact_relationship",
        "emergencyContactRelationship",
      ], 100) ??
      assignLimitedStringIfPresent(personUpdateData, "emergency_contact_phone", personPayload, [
        "emergency_contact_phone",
        "emergencyContactPhone",
      ], 50) ??
      assignLimitedStringIfPresent(personUpdateData, "emergency_contact_email", personPayload, [
        "emergency_contact_email",
        "emergencyContactEmail",
      ], 200) ??
      assignLimitedStringIfPresent(personUpdateData, "emergency_contact_notes", personPayload, [
        "emergency_contact_notes",
        "emergencyContactNotes",
      ], 2000)

    if (limitedTextError) {
      return NextResponse.json({ error: limitedTextError }, { status: 400 })
    }

    if (hasAnyProperty(personPayload, ["is_pep_risk", "isPepRisk"])) {
      const parsedPepRisk = booleanValue(
        valueFor(personPayload, ["is_pep_risk", "isPepRisk"]),
      )

      if (parsedPepRisk === null) {
        return NextResponse.json({ error: "invalid is_pep_risk" }, { status: 400 })
      }

      personUpdateData.is_pep_risk = parsedPepRisk
    }

    if (hasAnyProperty(personPayload, ["will_exists", "willExists"])) {
      const parsedWillExists = booleanValue(
        valueFor(personPayload, ["will_exists", "willExists"]),
      )

      if (parsedWillExists === null) {
        return NextResponse.json({ error: "invalid will_exists" }, { status: 400 })
      }

      personUpdateData.will_exists = parsedWillExists
    }

    if (hasAnyProperty(personPayload, ["will_is_current", "willIsCurrent"])) {
      const parsedWillIsCurrent = booleanValue(
        valueFor(personPayload, ["will_is_current", "willIsCurrent"]),
      )

      if (parsedWillIsCurrent === null) {
        return NextResponse.json({ error: "invalid will_is_current" }, { status: 400 })
      }

      personUpdateData.will_is_current = parsedWillIsCurrent
    }

    if (hasAnyProperty(personPayload, ["will_date", "willDate"])) {
      const parsedWillDate = optionalDateValue(
        valueFor(personPayload, ["will_date", "willDate"]),
      )

      if (parsedWillDate === "invalid") {
        return NextResponse.json({ error: "invalid will_date" }, { status: 400 })
      }

      personUpdateData.will_date = parsedWillDate
    }

    const personData = coerceEmptyToNull(
      personUpdateData,
      CHECK_CONSTRAINED_PERSON_FIELDS,
    )

    const updatedPerson = await db.person.update({
      where: { id },
      data: personData,
    })

    if (firstName || lastName) {
      const displayName = `${firstName ?? existingPerson.legal_given_name} ${
        lastName ?? existingPerson.legal_family_name
      }`.trim()

      const partyData = coerceEmptyToNull(
        {
          display_name: displayName,
        },
        CHECK_CONSTRAINED_PARTY_FIELDS,
      )

      await db.party.update({
        where: { id },
        data: partyData,
      })
    }

    let employmentColumns: Set<string> | null = null

    if (hasEmploymentPayload) {
      const [existingEmployment, statusOptions, columns] = await Promise.all([
        db.employment_profile.findFirst({
          where: {
            party_id: id,
            effective_to: null,
          },
          orderBy: [
            {
              effective_from: "desc",
            },
            {
              created_at: "desc",
            },
          ],
        }),
        getEmploymentStatusOptions(),
        getEmploymentColumns(),
      ])

      employmentColumns = columns
      const statusValues = statusOptions.length > 0 ? statusOptions : ["other"]

      const incomingEmploymentStatus = toNullableString(payload.employmentStatus)
      const resolvedEmploymentStatus =
        incomingEmploymentStatus && statusValues.includes(incomingEmploymentStatus)
          ? incomingEmploymentStatus
          : existingEmployment?.employment_status && statusValues.includes(existingEmployment.employment_status)
            ? existingEmployment.employment_status
            : statusValues.includes("other")
              ? "other"
              : statusValues[0]

      const incomingEmployerName = hasEmployerName
        ? toNullableString(payload.employerName)
        : undefined
      const incomingOccupation = hasOccupation ? toNullableString(payload.occupation) : undefined
      const incomingIndustry = hasIndustry ? toNullableString(payload.industry) : undefined
      const incomingEmploymentType = hasEmploymentType
        ? toNullableString(payload.employmentType)
        : undefined

      const hasAnyEmploymentInput = Boolean(
        incomingEmploymentStatus ||
          incomingEmployerName ||
          incomingOccupation ||
          incomingIndustry ||
          incomingEmploymentType,
      )

      if (existingEmployment) {
        const employmentData = coerceEmptyToNull(
          {
            employment_status: resolvedEmploymentStatus,
            employer_business_name:
              incomingEmployerName !== undefined
                ? incomingEmployerName
                : existingEmployment.employer_business_name,
            occupation_title:
              incomingOccupation !== undefined
                ? incomingOccupation
                : existingEmployment.occupation_title,
            industry: incomingIndustry !== undefined ? incomingIndustry : existingEmployment.industry,
          },
          CHECK_CONSTRAINED_EMPLOYMENT_PROFILE_FIELDS,
        )

        await db.employment_profile.update({
          where: {
            id: existingEmployment.id,
          },
          data: employmentData,
        })

        if (columns.has("employment_type") && incomingEmploymentType !== undefined) {
          await db.$executeRawUnsafe(
            `UPDATE employment_profile
             SET employment_type = $1
             WHERE id = $2`,
            incomingEmploymentType,
            existingEmployment.id,
          )
        }
      } else if (hasAnyEmploymentInput) {
        const employmentData = coerceEmptyToNull(
          {
            party_id: id,
            employment_status: resolvedEmploymentStatus,
            employer_business_name: incomingEmployerName ?? null,
            occupation_title: incomingOccupation ?? null,
            industry: incomingIndustry ?? null,
            effective_from: new Date(),
          },
          CHECK_CONSTRAINED_EMPLOYMENT_PROFILE_FIELDS,
        )

        const createdEmployment = await db.employment_profile.create({
          data: employmentData,
        })

        if (columns.has("employment_type") && incomingEmploymentType !== undefined) {
          await db.$executeRawUnsafe(
            `UPDATE employment_profile
             SET employment_type = $1
             WHERE id = $2`,
            incomingEmploymentType,
            createdEmployment.id,
          )
        }
      }
    }

    const updatedParty = await db.party.findUnique({
      where: { id },
    })

    const columns = employmentColumns ?? (await getEmploymentColumns())
    const employmentRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT
         employment_status,
         employer_business_name,
         occupation_title,
         industry,
         ${columns.has("employment_type") ? "employment_type" : "NULL::text AS employment_type"}
       FROM employment_profile
       WHERE party_id = $1
         AND effective_to IS NULL
       ORDER BY effective_from DESC, created_at DESC
       LIMIT 1`,
      id,
    )

    const employment = employmentRows[0]

    return NextResponse.json({
      id,
      displayName:
        updatedParty?.display_name ??
        `${updatedPerson.legal_given_name} ${updatedPerson.legal_family_name}`.trim(),
      person: updatedPerson,
      employment: employment
        ? {
            employmentStatus:
              typeof employment.employment_status === "string"
                ? employment.employment_status
                : null,
            employerName:
              typeof employment.employer_business_name === "string"
                ? employment.employer_business_name
                : null,
            occupation:
              typeof employment.occupation_title === "string"
                ? employment.occupation_title
                : null,
            industry: typeof employment.industry === "string" ? employment.industry : null,
            employmentType:
              typeof employment.employment_type === "string" ? employment.employment_type : null,
          }
        : null,
    })
  } catch (error) {
    console.error("[client update error]", error)
    return NextResponse.json({ error: "failed to update client" }, { status: 500 })
  }
}

async function deleteClient(
  _request: Request,
  { params }: ClientRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const sessionEmail = session.user?.email?.trim().toLowerCase() ?? ""
  if (!sessionEmail) {
    return NextResponse.json({ error: "session email missing" }, { status: 401 })
  }

  const actor = await db.user_account.findUnique({
    where: {
      email: sessionEmail,
    },
    select: {
      id: true,
    },
  })

  if (!actor) {
    return NextResponse.json({ error: "signed-in user is not mapped to user_account" }, { status: 403 })
  }

  const { id } = await params

  try {
    const result = await hardDeleteParty(id, actor.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PartyDeleteBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    if (error instanceof PartyNotFoundError) {
      return NextResponse.json({ error: "client not found" }, { status: 404 })
    }

    console.error("[client delete error]", error)
    return NextResponse.json({ error: "failed to delete client" }, { status: 500 })
  }
}

export const PATCH = withAuditTrail<ClientRouteContext>(updateClient, {
  entity_type: "person",
  action: "UPDATE",
  beforeFn: async (_request, context) =>
    loadClientRecordSnapshot(await routeParamId(context)),
  afterFn: async (_request, context) =>
    loadClientRecordSnapshot(await routeParamId(context)),
  entityIdFn: async (_request, context) => routeParamId(context),
})

export const DELETE = withAuditTrail<ClientRouteContext>(deleteClient, {
  entity_type: "person",
  action: "DELETE",
  beforeFn: async (_request, context) =>
    loadClientParentSnapshot(await routeParamId(context)),
  afterFn: async () => null,
  entityIdFn: async (_request, context) => routeParamId(context),
  metadataFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<{ counts?: Record<string, number> }>(auditContext)
    return {
      cascaded: payload?.counts ?? {},
    }
  },
})
