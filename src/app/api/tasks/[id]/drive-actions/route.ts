import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { sendMailAsAdviser } from "@/lib/graphMail"
import { applyMergeFields, type ClientMergeData } from "@/lib/mergeFields"
import { resolveEmailForParty } from "@/lib/party-contact"

const DRIVE_INITIAL_MEETING_TASK_TITLE = "Drive Initial Meeting booking"
const BOOKING_LINK_TEMPLATE_ID = "calendly_initial_meeting_booking_link"
const DEFAULT_INITIAL_MEETING_URL = "https://calendly.com/arwm/initial-meeting"

type DriveAction = "send_link" | "self_book"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function toHtmlBodyFromPlainText(value: string) {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

  return escaped
    .split(/\r?\n/)
    .map((line) => (line ? line : "&nbsp;"))
    .join("<br />")
}

function firstWord(value: string | null | undefined) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim()
  if (!normalized) {
    return ""
  }

  return normalized.split(/\s+/).find(Boolean) ?? ""
}

function getInitialMeetingBookingUrl() {
  return process.env.CALENDLY_INITIAL_MEETING_URL?.trim() || DEFAULT_INITIAL_MEETING_URL
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const action = typeof payload.action === "string" ? payload.action.trim() : ""
  if (action !== "send_link" && action !== "self_book") {
    return NextResponse.json({ error: "action must be send_link or self_book" }, { status: 400 })
  }

  const actorEmail = session.user?.email?.trim().toLowerCase() ?? ""
  if (!actorEmail) {
    return NextResponse.json({ error: "session email missing" }, { status: 401 })
  }

  try {
    const actor = await db.user_account.findUnique({
      where: {
        email: actorEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!actor) {
      return NextResponse.json({ error: "signed-in user is not mapped to user_account" }, { status: 403 })
    }

    const spawnedTask = await db.workflow_spawned_task.findFirst({
      where: {
        task_id: id,
      },
      include: {
        workflow_task_template: {
          select: {
            title: true,
          },
        },
        workflow_instance: {
          include: {
            engagement: {
              select: {
                id: true,
                party_id: true,
                household_id: true,
                primary_adviser_id: true,
              },
            },
          },
        },
      },
    })

    if (!spawnedTask || !spawnedTask.workflow_instance.engagement) {
      return NextResponse.json({ error: "task is not linked to a workflow engagement" }, { status: 404 })
    }

    if (spawnedTask.workflow_task_template.title !== DRIVE_INITIAL_MEETING_TASK_TITLE) {
      return NextResponse.json({ error: "drive actions are only available on Drive Initial Meeting booking tasks" }, { status: 400 })
    }

    const engagement = spawnedTask.workflow_instance.engagement

    if (action === "self_book") {
      await db.file_note.create({
        data: {
          party_id: engagement.party_id,
          household_id: engagement.household_id,
          engagement_id: engagement.id,
          note_type: "general",
          text: "Adviser will book Initial Meeting in Calendly directly.",
          author_user_id: actor.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      return NextResponse.json({
        ok: true,
        message: "Recorded that adviser will book in Calendly directly.",
      })
    }

    if (!engagement.party_id) {
      return NextResponse.json({ error: "engagement has no linked party" }, { status: 400 })
    }

    const party = await db.party.findUnique({
      where: {
        id: engagement.party_id,
      },
      select: {
        id: true,
        display_name: true,
        person: {
          select: {
            legal_given_name: true,
            legal_family_name: true,
            email_primary: true,
          },
        },
        contact_method: {
          where: {
            end_date: null,
          },
          select: {
            channel: true,
            value: true,
            preferred_flag: true,
            do_not_use_flag: true,
            created_at: true,
          },
        },
      },
    })

    if (!party) {
      return NextResponse.json({ error: "party not found" }, { status: 404 })
    }

    const recipientEmail = resolveEmailForParty(party)
    if (!recipientEmail) {
      return NextResponse.json({ error: "party does not have an email address" }, { status: 400 })
    }

    const template = await db.emailTemplate.findUnique({
      where: {
        id: BOOKING_LINK_TEMPLATE_ID,
      },
      select: {
        id: true,
        subject: true,
        body: true,
        isActive: true,
      },
    })

    if (!template || !template.isActive) {
      return NextResponse.json({ error: "booking link template is missing or inactive" }, { status: 500 })
    }

    const clientFirstName = party.person?.legal_given_name || firstWord(party.display_name) || "there"
    const clientLastName = party.person?.legal_family_name ?? ""
    const adviserName = actor.name || "Andrew Rowan"

    const mergeData: ClientMergeData = {
      firstName: clientFirstName,
      lastName: clientLastName,
      fullName: party.display_name,
      email: recipientEmail,
      phone: "",
    }

    const subject = applyMergeFields(template.subject, mergeData, {
      clientFirstName,
      adviserName,
      calendlyInitialMeetingUrl: getInitialMeetingBookingUrl(),
    })
    const bodyText = applyMergeFields(template.body, mergeData, {
      clientFirstName,
      adviserName,
      calendlyInitialMeetingUrl: getInitialMeetingBookingUrl(),
    })
    const bodyHtml = toHtmlBodyFromPlainText(bodyText)

    const { messageId } = await sendMailAsAdviser({
      toEmail: recipientEmail,
      toName: party.display_name,
      subject,
      htmlBody: bodyHtml,
    })

    await db.emailLog.create({
      data: {
        clientId: party.id,
        templateId: template.id,
        subject,
        body: bodyHtml,
        sentBy: actor.email,
        status: "sent",
        graphMessageId: messageId || null,
      },
    })

    await db.file_note.create({
      data: {
        party_id: engagement.party_id,
        household_id: engagement.household_id,
        engagement_id: engagement.id,
        note_type: "general",
        text: "Initial Meeting booking link sent to client.",
        author_user_id: actor.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      message: "Booking link email sent to client.",
    })
  } catch (error) {
    console.error(`[task drive action error] ${id} ${action as DriveAction} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to run drive action" }, { status: 500 })
  }
}
