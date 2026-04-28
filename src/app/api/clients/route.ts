import { NextResponse } from "next/server"

import { loadClientRecordSnapshot, responseId } from "@/lib/client-audit-snapshots"
import { db } from "@/lib/db"
import { withAuditTrail } from "@/lib/audit-middleware"

async function createClient(request: Request) {
  const {
    firstName,
    lastName,
    preferredName,
    dateOfBirth,
    email,
    mobile,
    relationshipStatus,
    countryOfResidence,
  } = await request.json()

  if (!firstName || !lastName || !dateOfBirth) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 })
  }

  try {
    const party = await db.party.create({
      data: {
        party_type: "person",
        display_name: `${firstName} ${lastName}`.trim(),
        status: "active",
      },
    })

    await db.person.create({
      data: {
        id: party.id,
        legal_given_name: firstName,
        legal_family_name: lastName,
        preferred_name: preferredName || null,
        date_of_birth: new Date(dateOfBirth),
        email_primary: email || null,
        mobile_phone: mobile || null,
        relationship_status: relationshipStatus || null,
        country_of_residence: countryOfResidence || "AU",
        citizenships: [],
      },
    })

    await db.client_classification.create({
      data: {
        party_id: party.id,
        lifecycle_stage: "prospect",
      },
    })

    return NextResponse.json({ id: party.id })
  } catch {
    return NextResponse.json({ error: "failed to create client" }, { status: 500 })
  }
}

export const POST = withAuditTrail(createClient, {
  entity_type: "person",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseId(auditContext)
    return id ? loadClientRecordSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
})
