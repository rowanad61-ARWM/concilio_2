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
      preferredName,
      dateOfBirth,
      email,
      mobile,
      relationshipStatus,
      countryOfResidence,
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

    const personData = coerceEmptyToNull(
      {
        legal_given_name: firstName ?? existingPerson.legal_given_name,
        legal_family_name: lastName ?? existingPerson.legal_family_name,
        preferred_name: preferredName ?? null,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth) : existingPerson.date_of_birth,
        email_primary: email ?? null,
        mobile_phone: mobile ?? null,
        relationship_status: relationshipStatus ?? null,
        country_of_residence: countryOfResidence ?? null,
        ...(hasAddressResidential ? { address_residential: addressResidential } : {}),
        ...(hasAddressPostal ? { address_postal: addressPostal } : {}),
      },
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
