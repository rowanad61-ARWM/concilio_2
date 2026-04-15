import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { sendMailAsAdviser } from "@/lib/graphMail"

type SendEmailPayload = {
  clientId?: unknown
  templateId?: unknown
  subject?: unknown
  body?: unknown
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed
}

function toClientDisplayName(client: {
  display_name: string
  person: {
    preferred_name: string | null
    legal_given_name: string
    legal_family_name: string
  } | null
}) {
  const first = client.person?.preferred_name || client.person?.legal_given_name || ""
  const last = client.person?.legal_family_name || ""
  return `${first} ${last}`.trim() || client.display_name
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let payload: SendEmailPayload
  try {
    payload = (await request.json()) as SendEmailPayload
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const clientId = toNonEmptyString(payload.clientId)
  const subject = toNonEmptyString(payload.subject)
  const body = typeof payload.body === "string" ? payload.body : ""
  const templateId =
    typeof payload.templateId === "string" && payload.templateId.trim() ? payload.templateId.trim() : null

  if (!clientId || !subject || !body.trim()) {
    return NextResponse.json(
      { error: "clientId, subject and body are required" },
      { status: 400 },
    )
  }

  const client = await db.party.findUnique({
    where: { id: clientId },
    include: { person: true },
  })

  if (!client) {
    return NextResponse.json({ error: "client not found" }, { status: 404 })
  }

  const clientEmail = client.person?.email_primary?.trim() ?? ""
  if (!clientEmail) {
    return NextResponse.json({ error: "client does not have an email address" }, { status: 400 })
  }

  const sentBy = session.user?.email?.trim() || "system@concilio.local"
  const clientName = toClientDisplayName(client)

  try {
    const { messageId } = await sendMailAsAdviser({
      toEmail: clientEmail,
      toName: clientName,
      subject,
      htmlBody: body,
    })

    await db.emailLog.create({
      data: {
        clientId,
        templateId,
        subject,
        body,
        sentBy,
        status: "sent",
        graphMessageId: messageId || null,
      },
    })

    return NextResponse.json({ ok: true, messageId })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "failed to send email"
    const failedBody = `${body}\n\n<!-- send-error: ${errorMessage} -->`

    await db.emailLog.create({
      data: {
        clientId,
        templateId,
        subject,
        body: failedBody,
        sentBy,
        status: "failed",
        graphMessageId: null,
      },
    })

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

