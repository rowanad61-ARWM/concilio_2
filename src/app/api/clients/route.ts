import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export async function POST(request: Request) {
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

    return NextResponse.json({ id: party.id })
  } catch {
    return NextResponse.json({ error: "failed to create client" }, { status: 500 })
  }
}