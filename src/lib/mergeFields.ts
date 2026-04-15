export type ClientMergeData = {
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
}

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

export function applyMergeFields(template: string, client: ClientMergeData): string {
  const adviserName = "Andrew Rowan"
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
  }

  return template.replace(/{{\s*([^}]+?)\s*}}/g, (match, rawToken: string) => {
    const token = rawToken.trim()
    const replacement = values[token]
    return replacement === undefined ? match : replacement
  })
}

