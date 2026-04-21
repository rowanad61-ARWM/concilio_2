import { getCalendlyMeetingTypeLabel } from "@/lib/calendly"
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

function readDateTime(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  return null
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseWorkflowStages(value: unknown) {
  if (!value) {
    return []
  }

  let rawStages: unknown = value

  if (typeof rawStages === "string") {
    try {
      rawStages = JSON.parse(rawStages)
    } catch {
      return []
    }
  }

  if (!Array.isArray(rawStages)) {
    return []
  }

  return rawStages
    .map((stage) => {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return null
      }

      const stageValue = stage as Record<string, unknown>
      const key = readString(stageValue.key)
      const label = readString(stageValue.label)
      const order = readNumber(stageValue.order)

      if (!key || !label || order === null) {
        return null
      }

      return {
        key,
        label,
        order,
      }
    })
    .filter((stage): stage is { key: string; label: string; order: number } => Boolean(stage))
    .sort((left, right) => left.order - right.order)
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
  const source = readString(row.source)
  const meetingTypeKey = readString(row.meeting_type_key)
  const description = readString(row.description) ?? readString(row.notes)
  const title =
    source?.toUpperCase() === "CALENDLY"
      ? getCalendlyMeetingTypeLabel(meetingTypeKey)
      : readString(row.title) ?? buildFallbackTitle(description)
  const workflowInstanceId = readString(row.workflow_instance_id)
  const workflowStages = parseWorkflowStages(row.workflow_template_stages)
  const workflowCurrentStage = readString(row.workflow_current_stage)

  return {
    id: readString(row.id) ?? "",
    engagementType: readString(row.engagement_type) ?? "other",
    title,
    source,
    meetingTypeKey,
    openedAt: readDateTime(row.opened_at),
    status: readString(row.status) ?? "active",
    startedAt:
      (source?.toUpperCase() === "CALENDLY"
        ? readDateTime(row.opened_at) ?? readDateTime(row.started_at)
        : readDateTime(row.started_at) ?? readDateTime(row.opened_at)) ??
      readDateTime(row.created_at) ??
      new Date().toISOString(),
    workflowInstance:
      workflowInstanceId && workflowCurrentStage
        ? {
            id: workflowInstanceId,
            currentStage: workflowCurrentStage,
            status: readString(row.workflow_status) ?? "active",
            stages: workflowStages,
          }
        : null,
  }
}
