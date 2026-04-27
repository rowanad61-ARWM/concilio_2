export type ClientMergeData = {
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
}

export type MergeFieldOverrides = {
  clientFirstName?: string
  adviserName?: string
  meetingDate?: string
  meetingDatetime?: string
  meetingDuration?: string
  meetingLocation?: string
  calendlyRescheduleUrl?: string
  calendlyCancelUrl?: string
  calendlyInitialMeetingUrl?: string
  calendlyDiscoveryUrl?: string
  calendlyAdviceUrl?: string
}

const DEFAULT_DISCOVERY_BOOKING_URL = "https://calendly.com/arwm/discovery-meeting"

export const MERGE_FIELD_TOKENS = [
  "{{client.firstName}}",
  "{{client.lastName}}",
  "{{client.fullName}}",
  "{{client.email}}",
  "{{client.phone}}",
  "{{adviser.name}}",
  "{{adviser.email}}",
  "{{date.today}}",
  "{{date.year}}",
  "{{client_first_name}}",
  "{{adviser_name}}",
  "{{meeting_date}}",
  "{{meeting_datetime}}",
  "{{meeting_duration}}",
  "{{meeting_location}}",
  "{{calendly_reschedule_url}}",
  "{{calendly_cancel_url}}",
  "{{calendly_initial_meeting_url}}",
  "{{calendly_discovery_url}}",
  "{{calendly_advice_url}}",
] as const

function getDateValues(now: Date) {
  const today = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  return {
    today,
    year: String(now.getFullYear()),
  }
}

export function applyMergeFields(
  template: string,
  client: ClientMergeData,
  overrides: MergeFieldOverrides = {},
): string {
  const adviserName = overrides.adviserName ?? "Andrew Rowan"
  const clientFirstName = overrides.clientFirstName ?? client.firstName
  const adviserEmail = process.env.ADVISER_EMAIL ?? ""
  const dateValues = getDateValues(new Date())

  const values: Record<string, string> = {
    "client.firstName": client.firstName,
    "client.lastName": client.lastName,
    "client.fullName": client.fullName,
    "client.email": client.email,
    "client.phone": client.phone,
    "adviser.name": adviserName,
    "adviser.email": adviserEmail,
    "date.today": dateValues.today,
    "date.year": dateValues.year,
    client_first_name: clientFirstName,
    adviser_name: adviserName,
    meeting_date: overrides.meetingDate ?? "",
    meeting_datetime: overrides.meetingDatetime ?? "",
    meeting_duration: overrides.meetingDuration ?? "",
    meeting_location: overrides.meetingLocation ?? "",
    calendly_reschedule_url: overrides.calendlyRescheduleUrl ?? "",
    calendly_cancel_url: overrides.calendlyCancelUrl ?? "",
    calendly_initial_meeting_url:
      overrides.calendlyInitialMeetingUrl ?? "https://calendly.com/arwm/initial-meeting-1",
    calendly_discovery_url:
      overrides.calendlyDiscoveryUrl ?? process.env.CALENDLY_DISCOVERY_URL ?? DEFAULT_DISCOVERY_BOOKING_URL,
    calendly_advice_url: overrides.calendlyAdviceUrl ?? process.env.CALENDLY_ADVICE_URL ?? "",
  }

  return template.replace(/{{\s*([^}]+?)\s*}}/g, (match, rawToken: string) => {
    const token = rawToken.trim()
    const replacement = values[token]
    return replacement === undefined ? match : replacement
  })
}
