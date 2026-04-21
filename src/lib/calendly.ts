import { createHmac, timingSafeEqual } from "node:crypto"

const CALENDLY_MEETING_TYPE_LABELS: Record<string, string> = {
  INITIAL_MEETING: "Initial Meeting",
  FIFTEEN_MIN_CALL: "15 Minute Call",
  GENERAL_MEETING: "General Meeting",
  ANNUAL_REVIEW: "Annual Review",
  NINETY_DAY_RECAP: "90 Day Recap",
}

const MELBOURNE_TIMEZONE = "Australia/Melbourne"

type CalendlyQuestionAndAnswer = {
  question?: string | null
  answer?: string | null
}

type CalendlyEventMembership = {
  user_email?: string | null
}

type CalendlyLocation = {
  type?: string | null
  location?: string | null
  join_url?: string | null
}

type CalendlyScheduledEvent = {
  uri?: string | null
  event_type?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: CalendlyLocation | string | null
  event_memberships?: CalendlyEventMembership[] | null
}

type CalendlyInviteePayload = {
  uri?: string | null
  email?: string | null
  name?: string | null
  cancel_url?: string | null
  reschedule_url?: string | null
  text_reminder_number?: string | null
  questions_and_answers?: CalendlyQuestionAndAnswer[] | null
  scheduled_event?: CalendlyScheduledEvent | null
  event?: string | null
  event_type?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: CalendlyLocation | string | null
  event_memberships?: CalendlyEventMembership[] | null
  old_invitee?: string | null
  old_invitee_uri?: string | null
  rescheduled?: boolean | null
  cancellation?: {
    reason?: string | null
    canceller_type?: string | null
    canceled_by?: string | null
    canceler_type?: string | null
  } | null
  cancel_reason?: string | null
  canceller_type?: string | null
  canceled_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type CalendlyRoutingFormPayload = {
  id?: string | null
  form_name?: string | null
  name?: string | null
}

export type CalendlyInviteeCreatedWebhookPayload = {
  event: "invitee.created"
  created_at?: string
  payload: CalendlyInviteePayload
}

export type CalendlyInviteeCanceledWebhookPayload = {
  event: "invitee.canceled"
  created_at?: string
  payload: CalendlyInviteePayload
}

export type CalendlyRoutingFormSubmissionWebhookPayload = {
  event: "routing_form_submission.created"
  created_at?: string
  payload: CalendlyRoutingFormPayload
}

export type CalendlyWebhookPayload =
  | CalendlyInviteeCreatedWebhookPayload
  | CalendlyInviteeCanceledWebhookPayload
  | CalendlyRoutingFormSubmissionWebhookPayload

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseSignatureHeader(header: string | null) {
  if (!header) {
    return null
  }

  const segments = header.split(",").map((segment) => segment.trim())
  const values = new Map<string, string>()

  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=")
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      continue
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase()
    const value = segment.slice(separatorIndex + 1).trim()
    values.set(key, value)
  }

  const timestampRaw = values.get("t")
  const digest = values.get("v1")

  if (!timestampRaw || !/^\d+$/.test(timestampRaw) || !digest || !/^[0-9a-f]+$/i.test(digest)) {
    return null
  }

  const timestamp = Number(timestampRaw)
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return null
  }

  return {
    timestamp,
    digest: digest.toLowerCase(),
  }
}

export function verifyCalendlySignature(rawBody: string, header: string | null, signingKey: string): boolean {
  const parsedHeader = parseSignatureHeader(header)
  if (!parsedHeader) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const ageSeconds = nowSeconds - parsedHeader.timestamp
  if (ageSeconds < 0 || ageSeconds > 300) {
    return false
  }

  const signedPayload = `${parsedHeader.timestamp}.${rawBody}`
  const expectedDigest = createHmac("sha256", signingKey).update(signedPayload, "utf8").digest("hex")

  const expectedBuffer = Buffer.from(expectedDigest, "utf8")
  const receivedBuffer = Buffer.from(parsedHeader.digest, "utf8")

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function parseCalendlyPayload(rawBody: string): CalendlyWebhookPayload {
  const parsed = JSON.parse(rawBody) as unknown
  if (!isObject(parsed)) {
    throw new Error("invalid webhook payload")
  }

  const event = typeof parsed.event === "string" ? parsed.event : ""
  if (!event) {
    throw new Error("missing event")
  }

  const createdAt = typeof parsed.created_at === "string" ? parsed.created_at : undefined
  const payload = isObject(parsed.payload) ? parsed.payload : null
  if (!payload) {
    throw new Error("missing payload")
  }

  if (event === "invitee.created") {
    return {
      event,
      created_at: createdAt,
      payload: payload as CalendlyInviteePayload,
    }
  }

  if (event === "invitee.canceled") {
    return {
      event,
      created_at: createdAt,
      payload: payload as CalendlyInviteePayload,
    }
  }

  if (event === "routing_form_submission.created") {
    return {
      event,
      created_at: createdAt,
      payload: payload as CalendlyRoutingFormPayload,
    }
  }

  throw new Error(`unsupported event ${event}`)
}

function normalizePhoneToE164(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const plusDigits = `+${trimmed.replace(/[^\d]/g, "")}`
  if (/^\+[1-9]\d{7,14}$/.test(plusDigits)) {
    return plusDigits
  }

  const digits = trimmed.replace(/[^\d]/g, "")
  if (!digits) {
    return null
  }

  if (digits.startsWith("00") && /^\d{10,17}$/.test(digits)) {
    const candidate = `+${digits.slice(2)}`
    if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
      return candidate
    }
  }

  if (digits.startsWith("61") && /^\d{9,14}$/.test(digits)) {
    const candidate = `+${digits}`
    if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
      return candidate
    }
  }

  if (digits.startsWith("0") && digits.length === 10) {
    const candidate = `+61${digits.slice(1)}`
    if (/^\+[1-9]\d{7,14}$/.test(candidate)) {
      return candidate
    }
  }

  return null
}

export function extractInviteePhone(payload: {
  text_reminder_number?: string | null
  questions_and_answers?: Array<{ question?: string | null; answer?: string | null }> | null
}): string | null {
  const directNumber =
    typeof payload.text_reminder_number === "string" ? payload.text_reminder_number.trim() : ""
  if (directNumber) {
    return normalizePhoneToE164(directNumber) ?? directNumber
  }

  const qas = Array.isArray(payload.questions_and_answers) ? payload.questions_and_answers : []
  for (const qa of qas) {
    const question = typeof qa?.question === "string" ? qa.question.trim().toLowerCase() : ""
    if (!question || !/(mobile|phone|cell)/i.test(question)) {
      continue
    }

    const answer = typeof qa?.answer === "string" ? qa.answer.trim() : ""
    if (!answer) {
      continue
    }

    return normalizePhoneToE164(answer) ?? answer
  }

  return null
}

export function getCalendlyMeetingTypeLabel(meetingTypeKey: string | null | undefined) {
  const normalizedKey = meetingTypeKey?.trim().toUpperCase()
  if (!normalizedKey) {
    return "Calendly booking"
  }

  return CALENDLY_MEETING_TYPE_LABELS[normalizedKey] ?? "Calendly booking"
}

export function formatCalendlyMeetingDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

export function formatCalendlyMeetingDateTime(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const weekday = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    weekday: "long",
  }).format(parsed)
  const datePart = formatCalendlyMeetingDate(parsed)
  if (!datePart) {
    return null
  }

  const timePart = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(parsed)
    .replace(/\s/g, "")
    .toLowerCase()

  return `${weekday} ${datePart}, ${timePart}`
}
