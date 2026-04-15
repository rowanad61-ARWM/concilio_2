import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { applyMergeFields, type ClientMergeData } from "@/lib/mergeFields"

function toClientMergeData(client: {
  display_name: string
  person: {
    legal_given_name: string
    legal_family_name: string
    preferred_name: string | null
    email_primary: string | null
    mobile_phone: string | null
  } | null
}): ClientMergeData {
  const firstName = client.person?.preferred_name || client.person?.legal_given_name || ""
  const lastName = client.person?.legal_family_name || ""
  const fullName = `${firstName} ${lastName}`.trim() || client.display_name

  return {
    firstName,
    lastName,
    fullName,
    email: client.person?.email_primary ?? "",
    phone: client.person?.mobile_phone ?? "",
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const payload = (await request.json()) as { clientId?: string }
    const clientId = typeof payload.clientId === "string" ? payload.clientId : ""

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 })
    }

    const [template, client] = await Promise.all([
      db.emailTemplate.findFirst({
        where: {
          id,
          isActive: true,
        },
      }),
      db.party.findUnique({
        where: {
          id: clientId,
        },
        include: {
          person: true,
        },
      }),
    ])

    if (!template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 })
    }

    if (!client) {
      return NextResponse.json({ error: "client not found" }, { status: 404 })
    }

    const mergeData = toClientMergeData(client)
    const subject = applyMergeFields(template.subject, mergeData)
    const body = applyMergeFields(template.body, mergeData)

    return NextResponse.json({ subject, body })
  } catch (error) {
    console.error("[email template preview error]", error)
    return NextResponse.json({ error: "failed to render preview" }, { status: 500 })
  }
}

