import "server-only"

import { db } from "@/lib/db"
import {
  extractInviteePhone,
  type CalendlyInviteeCanceledWebhookPayload,
  type CalendlyInviteeCreatedWebhookPayload,
  type CalendlyRoutingFormSubmissionWebhookPayload,
} from "@/lib/calendly"

type MeetingTypeMapRow = {
  meeting_type_key: string
  display_name: string
  calendly_event_type_uri: string | null
  auto_create_prospect: boolean
  unresolved_log_level: string
  active: boolean
}

type ResolvedAdvisor = {
  id: string
  email: string
} | null

type ResolvedClient = {
  id: string
  display_name: string
} | null

const SYNTHETIC_GENERAL_MEETING: MeetingTypeMapRow = {
  meeting_type_key: "GENERAL_MEETING",
  display_name: "General Meeting",
  calendly_event_type_uri: null,
  auto_create_prospect: false,
  unresolved_log_level: "info",
  active: true,
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function parseDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function tailFromUri(uri: string | null) {
  if (!uri) {
    return null
  }

  const parts = uri
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)

  return parts[parts.length - 1] ?? null
}

function appendSystemNote(existingNotes: string | null, systemNote: string) {
  if (!existingNotes?.trim()) {
    return systemNote
  }

  if (existingNotes.includes(systemNote)) {
    return existingNotes
  }

  return `${existingNotes.trim()}\n\n${systemNote}`
}

function logByLevel(level: string, message: string) {
  if (level.trim().toLowerCase() === "info") {
    console.info(message)
    return
  }

  console.warn(message)
}

function extractScheduledEvent(payload: CalendlyInviteeCreatedWebhookPayload["payload"]) {
  const scheduledEvent = payload.scheduled_event ?? null
  const eventUri = normalizeString(scheduledEvent?.uri ?? payload.event)
  const eventTypeUri = normalizeString(scheduledEvent?.event_type ?? payload.event_type)
  const startTime = normalizeString(scheduledEvent?.start_time ?? payload.start_time)
  const endTime = normalizeString(scheduledEvent?.end_time ?? payload.end_time)
  const eventMemberships = Array.isArray(scheduledEvent?.event_memberships)
    ? scheduledEvent?.event_memberships
    : Array.isArray(payload.event_memberships)
      ? payload.event_memberships
      : []

  return {
    eventUri,
    eventTypeUri,
    startTime,
    endTime,
    eventMemberships,
  }
}

function buildQuestionAndAnswerLines(
  questionsAndAnswers: Array<{ question?: string | null; answer?: string | null }> | null | undefined,
) {
  const qas = Array.isArray(questionsAndAnswers) ? questionsAndAnswers : []
  if (qas.length === 0) {
    return "Questions and answers: none"
  }

  const lines = qas.map((qa) => {
    const question = normalizeString(qa.question) ?? "Question"
    const answer = normalizeString(qa.answer) ?? "(no answer)"
    return `- ${question}: ${answer}`
  })

  return `Questions and answers:\n${lines.join("\n")}`
}

async function findClientByEmail(inviteeEmail: string): Promise<ResolvedClient> {
  const normalizedEmail = inviteeEmail.trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }

  const matchedParty = await db.party.findFirst({
    where: {
      OR: [
        {
          person: {
            is: {
              OR: [
                {
                  email_primary: {
                    equals: normalizedEmail,
                    mode: "insensitive",
                  },
                },
                {
                  email_alternate: {
                    equals: normalizedEmail,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
        {
          contact_method: {
            some: {
              channel: {
                equals: "email",
                mode: "insensitive",
              },
              value: {
                equals: normalizedEmail,
                mode: "insensitive",
              },
              end_date: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      display_name: true,
    },
  })

  if (!matchedParty) {
    return null
  }

  return {
    id: matchedParty.id,
    display_name: matchedParty.display_name,
  }
}

async function findClientByDisplayName(inviteeName: string): Promise<ResolvedClient> {
  const normalizedName = inviteeName.trim()
  if (!normalizedName) {
    return null
  }

  const matchedParty = await db.party.findFirst({
    where: {
      display_name: {
        equals: normalizedName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      display_name: true,
    },
  })

  if (!matchedParty) {
    return null
  }

  return {
    id: matchedParty.id,
    display_name: matchedParty.display_name,
  }
}

async function createProspectPartyFromCalendly(params: {
  inviteeName: string
  inviteeEmail: string
  phone: string | null
}): Promise<{ id: string; display_name: string }> {
  const displayName = params.inviteeName.trim() || params.inviteeEmail.trim() || "Calendly Prospect"
  const email = params.inviteeEmail.trim().toLowerCase()
  const phone = params.phone?.trim() ?? null

  // TODO(task-42a): route party auto-create through shared helper when one is extracted.
  const createdParty = await db.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        party_type: "person",
        display_name: displayName,
        status: "active",
      },
      select: {
        id: true,
        display_name: true,
      },
    })

    await tx.client_classification.create({
      data: {
        party_id: party.id,
        lifecycle_stage: "prospect",
      },
    })

    const contactRows: Array<{ party_id: string; channel: string; value: string }> = []
    if (email) {
      contactRows.push({
        party_id: party.id,
        channel: "email",
        value: email,
      })
    }

    if (phone) {
      contactRows.push({
        party_id: party.id,
        channel: "mobile",
        value: phone,
      })
    }

    if (contactRows.length > 0) {
      await tx.contact_method.createMany({
        data: contactRows,
      })
    }

    return party
  })

  return createdParty
}

function getInviteeCreatedTimestamp(payload: CalendlyInviteeCreatedWebhookPayload) {
  const payloadCreatedAt = normalizeString(payload.payload.created_at)
  return parseDate(payloadCreatedAt ?? payload.created_at ?? null) ?? new Date()
}

export async function resolveMeetingType(eventTypeUri: string | null): Promise<MeetingTypeMapRow> {
  const normalizedEventTypeUri = normalizeString(eventTypeUri)
  if (!normalizedEventTypeUri) {
    console.warn("[calendly webhook] invitee.created meeting-type-fallback missing-event-type-uri")
    return SYNTHETIC_GENERAL_MEETING
  }

  const mappedRow = await db.calendly_event_type_map.findUnique({
    where: {
      calendly_event_type_uri: normalizedEventTypeUri,
    },
    select: {
      meeting_type_key: true,
      display_name: true,
      calendly_event_type_uri: true,
      auto_create_prospect: true,
      unresolved_log_level: true,
      active: true,
    },
  })

  if (!mappedRow || !mappedRow.active) {
    console.warn(`[calendly webhook] invitee.created meeting-type-fallback ${normalizedEventTypeUri}`)
    return SYNTHETIC_GENERAL_MEETING
  }

  return mappedRow
}

export async function resolveAdvisorFromPayload(
  payload: CalendlyInviteeCreatedWebhookPayload["payload"],
): Promise<ResolvedAdvisor> {
  const { eventMemberships } = extractScheduledEvent(payload)
  const advisorEmailRaw = normalizeString(eventMemberships?.[0]?.user_email)
  if (!advisorEmailRaw) {
    console.warn("[calendly webhook] invitee.created advisor-unresolved missing-user-email")
    return null
  }

  const advisorEmail = advisorEmailRaw.toLowerCase()
  const advisor = await db.user_account.findFirst({
    where: {
      email: {
        equals: advisorEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
    },
  })

  if (!advisor) {
    console.warn(`[calendly webhook] invitee.created advisor-unresolved ${advisorEmail}`)
    return null
  }

  return advisor
}

export async function resolveOrCreateClient(
  inviteeEmail: string | null,
  inviteeName: string | null,
  phone: string | null,
  meetingTypeRow: MeetingTypeMapRow,
): Promise<ResolvedClient> {
  const normalizedInviteeEmail = normalizeString(inviteeEmail)?.toLowerCase() ?? null
  const normalizedInviteeName = normalizeString(inviteeName)

  if (normalizedInviteeEmail) {
    const emailMatch = await findClientByEmail(normalizedInviteeEmail)
    if (emailMatch) {
      return emailMatch
    }
  }

  if (normalizedInviteeName) {
    const nameMatch = await findClientByDisplayName(normalizedInviteeName)
    if (nameMatch) {
      console.warn(
        `[calendly webhook] invitee.created matched-by-name-not-email ${normalizedInviteeName}`,
      )
      return nameMatch
    }
  }

  if (meetingTypeRow.auto_create_prospect) {
    const createdProspect = await createProspectPartyFromCalendly({
      inviteeName: normalizedInviteeName ?? normalizedInviteeEmail ?? "Calendly Prospect",
      inviteeEmail: normalizedInviteeEmail ?? "",
      phone,
    })

    console.info(
      `[calendly webhook] invitee.created created-prospect ${normalizedInviteeEmail ?? createdProspect.id}`,
    )
    return createdProspect
  }

  const unresolvedKey = normalizedInviteeEmail ?? normalizedInviteeName ?? "unknown-invitee"
  logByLevel(
    meetingTypeRow.unresolved_log_level,
    `[calendly webhook] invitee.created unresolved-client ${unresolvedKey}`,
  )
  return null
}

/**
 * Extension point reserved for:
 * - Task 42b: per-meeting-type confirmation emails
 * - Task 42c: SMS reminders
 * - Task 43: workflow/task auto-creation
 */
export async function triggerPostBookingSideEffects(_engagement: { id: string }): Promise<void> {}

export async function handleInviteeCreated(payload: CalendlyInviteeCreatedWebhookPayload) {
  const scheduled = extractScheduledEvent(payload.payload)
  const eventUuid = tailFromUri(scheduled.eventUri)
  if (!eventUuid) {
    throw new Error("invitee.created missing scheduled event uuid")
  }

  const inviteeUuid = tailFromUri(normalizeString(payload.payload.uri))
  const meetingTypeRow = await resolveMeetingType(scheduled.eventTypeUri)
  const advisor = await resolveAdvisorFromPayload(payload.payload)
  const inviteeEmail = normalizeString(payload.payload.email)
  const inviteeName = normalizeString(payload.payload.name)
  const phone = extractInviteePhone(payload.payload)
  const client = await resolveOrCreateClient(inviteeEmail, inviteeName, phone, meetingTypeRow)
  const startAt = parseDate(scheduled.startTime)
  const incomingCreatedAt = getInviteeCreatedTimestamp(payload)
  const rescheduledFrom =
    tailFromUri(normalizeString(payload.payload.old_invitee)) ??
    tailFromUri(normalizeString(payload.payload.old_invitee_uri))

  const notes = [
    "Calendly booking",
    `Meeting type: ${meetingTypeRow.display_name} (${meetingTypeRow.meeting_type_key})`,
    `Invitee: ${inviteeName ?? "unknown"} <${inviteeEmail ?? "unknown"}>`,
    `Phone: ${phone ?? "not provided"}`,
    `Start: ${scheduled.startTime ?? "unknown"}`,
    `End: ${scheduled.endTime ?? "unknown"}`,
    `Event type URI: ${scheduled.eventTypeUri ?? "unknown"}`,
    buildQuestionAndAnswerLines(payload.payload.questions_and_answers),
  ].join("\n")

  const existing = await db.engagement.findUnique({
    where: {
      calendly_event_uuid: eventUuid,
    },
    select: {
      id: true,
      updated_at: true,
      opened_at: true,
    },
  })

  if (existing && incomingCreatedAt.getTime() <= existing.updated_at.getTime()) {
    console.info(`[calendly webhook] invitee.created duplicate-ignored ${eventUuid}`)
    return
  }

  const now = new Date()
  const engagementData = {
    engagement_type: "other",
    status: "open",
    source: "CALENDLY" as const,
    meeting_type_key: meetingTypeRow.meeting_type_key,
    calendly_event_uuid: eventUuid,
    calendly_invitee_uuid: inviteeUuid,
    calendly_event_type_uri: scheduled.eventTypeUri,
    calendly_cancel_url: normalizeString(payload.payload.cancel_url),
    calendly_reschedule_url: normalizeString(payload.payload.reschedule_url),
    calendly_rescheduled_from: rescheduledFrom,
    party_id: client?.id ?? null,
    primary_adviser_id: advisor?.id ?? null,
    opened_at: startAt ?? existing?.opened_at ?? now,
    notes,
    updated_at: now,
  }

  const engagement = existing
    ? await db.engagement.update({
        where: {
          id: existing.id,
        },
        data: engagementData,
        select: {
          id: true,
        },
      })
    : await db.engagement.create({
        data: {
          ...engagementData,
          created_at: now,
        },
        select: {
          id: true,
        },
      })

  void triggerPostBookingSideEffects(engagement).catch((error) => {
    console.error(`[calendly webhook] invitee.created side-effects-failed ${eventUuid} ${toErrorMessage(error)}`)
  })

  console.info(
    `[calendly webhook] invitee.created upserted ${eventUuid}`,
  )
}

export async function handleInviteeCanceled(payload: CalendlyInviteeCanceledWebhookPayload) {
  const eventUuid =
    tailFromUri(normalizeString(payload.payload.scheduled_event?.uri)) ??
    tailFromUri(normalizeString(payload.payload.event))
  if (!eventUuid) {
    throw new Error("invitee.canceled missing scheduled event uuid")
  }

  const engagement = await db.engagement.findUnique({
    where: {
      calendly_event_uuid: eventUuid,
    },
    select: {
      id: true,
      notes: true,
    },
  })

  if (!engagement) {
    console.info(`[calendly webhook] invitee.canceled unknown-event-ignored ${eventUuid}`)
    return
  }

  const rescheduled = payload.payload.rescheduled === true
  const cancellerType =
    normalizeString(payload.payload.cancellation?.canceller_type) ??
    normalizeString(payload.payload.cancellation?.canceler_type) ??
    normalizeString(payload.payload.canceller_type) ??
    normalizeString(payload.payload.canceled_by) ??
    "unknown"
  const cancelReason =
    normalizeString(payload.payload.cancellation?.reason) ??
    normalizeString(payload.payload.cancel_reason)

  const systemNote = rescheduled
    ? `Rescheduled by ${cancellerType} - awaiting new booking`
    : `Cancelled by ${cancellerType} - ${cancelReason ?? "no reason provided"}`

  await db.engagement.update({
    where: {
      id: engagement.id,
    },
    data: {
      status: "cancelled",
      completed_at: new Date(),
      notes: appendSystemNote(engagement.notes, systemNote),
      updated_at: new Date(),
    },
  })

  console.info(`[calendly webhook] invitee.canceled updated ${eventUuid}`)
}

export async function handleRoutingFormSubmission(
  payload: CalendlyRoutingFormSubmissionWebhookPayload,
) {
  const submissionId = normalizeString(payload.payload.id) ?? "unknown-submission"
  const formName = normalizeString(payload.payload.form_name) ?? normalizeString(payload.payload.name) ?? "unknown-form"

  console.info(`[calendly webhook] routing_form_submission.created accepted ${submissionId} (${formName})`)
  // TODO(Task 43): route form submissions into the workflow engine.
}
