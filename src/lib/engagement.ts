import type { TimelineEngagement } from "@/types/client-record"

export const ENGAGEMENT_TYPE_VALUES = [
  "onboarding",
  "annual_review",
  "soa",
  "roa",
  "insurance",
  "aged_care",
  "estate",
  "limited_advice",
  "one_off",
  "other",
] as const

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function buildFallbackTitle(description: string | null): string {
  if (!description) {
    return "Engagement"
  }

  const firstLine = description
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  return firstLine ?? "Engagement"
}

export function mapEngagementRow(row: Record<string, unknown>): TimelineEngagement {
  const description = readString(row.description) ?? readString(row.notes)
  const title = readString(row.title) ?? buildFallbackTitle(description)

  return {
    id: readString(row.id) ?? "",
    engagementType: readString(row.engagement_type) ?? "other",
    title,
    status: readString(row.status) ?? "active",
    startedAt:
      readString(row.started_at) ??
      readString(row.opened_at) ??
      readString(row.created_at) ??
      new Date().toISOString(),
  }
}

