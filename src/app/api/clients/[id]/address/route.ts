import { NextResponse } from "next/server"

import { db } from "@/lib/db"

function mapAddress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const address = value as Record<string, unknown>
  return {
    line1: typeof address.line1 === "string" ? address.line1 : null,
    line2: typeof address.line2 === "string" ? address.line2 : null,
    suburb: typeof address.suburb === "string" ? address.suburb : null,
    state: typeof address.state === "string" ? address.state : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
    country: typeof address.country === "string" ? address.country : null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const person = await db.person.findUnique({
      where: { id },
      select: {
        address_residential: true,
        address_postal: true,
      },
    })

    if (!person) {
      return NextResponse.json({ error: "person not found" }, { status: 404 })
    }

    return NextResponse.json({
      addressResidential: mapAddress(person.address_residential),
      addressPostal: mapAddress(person.address_postal),
    })
  } catch (error) {
    console.error("[client address fetch error]", error)
    return NextResponse.json({ error: "failed to fetch client address" }, { status: 500 })
  }
}
