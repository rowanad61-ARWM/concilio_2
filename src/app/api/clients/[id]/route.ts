import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const existingPerson = await db.person.findUnique({
      where: { id },
    })

    if (!existingPerson) {
      return NextResponse.json({ error: "person not found" }, { status: 404 })
    }

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

    const updatedPerson = await db.person.update({
      where: { id },
      data: {
        legal_given_name: firstName ?? existingPerson.legal_given_name,
        legal_family_name: lastName ?? existingPerson.legal_family_name,
        preferred_name: preferredName ?? null,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth) : existingPerson.date_of_birth,
        email_primary: email ?? null,
        mobile_phone: mobile ?? null,
        relationship_status: relationshipStatus ?? null,
        country_of_residence: countryOfResidence ?? null,
      },
    })

    if (firstName || lastName) {
      const displayName = `${firstName ?? existingPerson.legal_given_name} ${
        lastName ?? existingPerson.legal_family_name
      }`.trim()

      await db.party.update({
        where: { id },
        data: {
          display_name: displayName,
        },
      })
    }

    const updatedParty = await db.party.findUnique({
      where: { id },
    })

    return NextResponse.json({
      id,
      displayName: updatedParty?.display_name ?? `${updatedPerson.legal_given_name} ${updatedPerson.legal_family_name}`.trim(),
      person: updatedPerson,
    })
  } catch (error) {
    console.error("[client update error]", error)
    return NextResponse.json({ error: "failed to update client" }, { status: 500 })
  }
}
