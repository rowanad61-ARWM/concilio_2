import { NextResponse } from "next/server"

import { resolveCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function alertSummary(alertType: string, payload: unknown) {
  if (alertType === "file_note_review_outstanding" && isRecord(payload)) {
    return `File note ready: ${stringValue(payload.client_name) ?? "Client"}`
  }

  if (alertType === "file_note_generation_failed" && isRecord(payload)) {
    return `File note generation failed: ${stringValue(payload.client_name) ?? "Client"}`
  }

  return alertType.replace(/_/g, " ")
}

function alertHref(alertType: string, payload: unknown) {
  if (
    (alertType === "file_note_review_outstanding" || alertType === "file_note_generation_failed") &&
    isRecord(payload)
  ) {
    return stringValue(payload.review_url) ?? "/admin/alerts"
  }

  return "/admin/alerts"
}

export async function GET() {
  const user = await resolveCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const alerts = await db.alert_instance.findMany({
    where: {
      recipient_user_id: user.id,
      cleared_at: null,
    },
    orderBy: {
      occurred_at: "desc",
    },
    take: 10,
    select: {
      id: true,
      occurred_at: true,
      alert_type: true,
      entity_type: true,
      entity_id: true,
      payload: true,
    },
  })

  return NextResponse.json({
    alerts: alerts.map((alert) => ({
      id: alert.id,
      occurred_at: alert.occurred_at.toISOString(),
      alert_type: alert.alert_type,
      entity_type: alert.entity_type,
      entity_id: alert.entity_id,
      summary: alertSummary(alert.alert_type, alert.payload),
      href: alertHref(alert.alert_type, alert.payload),
      payload: alert.payload,
    })),
  })
}
