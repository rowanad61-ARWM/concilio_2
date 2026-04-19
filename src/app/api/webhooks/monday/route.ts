import { NextResponse } from "next/server"

import {
  handleColumnChange,
  handleItemDeleted,
  handleUpdateCreated,
  type MondayEvent,
} from "@/lib/monday-webhook"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function getPreview(rawBody: string) {
  return rawBody.replace(/\s+/g, " ").slice(0, 200)
}

function getNumericIdOrNull(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim())
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const preview = getPreview(rawBody)
  console.log(`[monday webhook] received preview=${preview}`)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch (error) {
    console.error(`[monday webhook] parse error ${toErrorMessage(error)}`)
    return NextResponse.json({ ok: true })
  }

  if (Object.prototype.hasOwnProperty.call(body, "challenge")) {
    return NextResponse.json({ challenge: body.challenge })
  }

  const event =
    body.event && typeof body.event === "object" && !Array.isArray(body.event)
      ? (body.event as MondayEvent)
      : null

  if (!event?.type || typeof event.type !== "string") {
    console.warn("[monday webhook] missing event type")
    return NextResponse.json({ ok: true })
  }

  const pulseId = getNumericIdOrNull(event.pulseId)
  const userId = getNumericIdOrNull(event.userId)
  console.log(
    `[monday webhook] type=${event.type} pulseId=${pulseId ?? "unknown"} userId=${userId ?? "unknown"}`,
  )

  if (event.type === "update_column_value" || event.type === "change_column_value") {
    await handleColumnChange(event)
    return NextResponse.json({ ok: true })
  }

  if (event.type === "delete_pulse") {
    await handleItemDeleted(event)
    return NextResponse.json({ ok: true })
  }

  if (event.type === "create_update") {
    await handleUpdateCreated(event)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
