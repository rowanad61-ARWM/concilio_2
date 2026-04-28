import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { withAuditTrail, type AuditLifecycleContext } from "@/lib/audit-middleware"
import { sendSms } from "@/lib/messagemedia"
import { responseJsonSnapshot } from "@/lib/webhook-cron-audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function getErrorHttpStatus(error: unknown) {
  const maybe = asObject(error)
  if (!maybe) {
    return undefined
  }

  const value = maybe.httpStatus
  if (typeof value === "number" && Number.isInteger(value)) {
    return value
  }

  return undefined
}

function getErrorResponseBody(error: unknown) {
  const maybe = asObject(error)
  if (!maybe) {
    return undefined
  }

  const value = maybe.responseBody
  if (typeof value === "string" && value) {
    return value
  }

  return undefined
}

function smsTestMetadata(
  _request: Request,
  _context: unknown,
  auditContext: AuditLifecycleContext,
) {
  const afterSnapshot = asObject(auditContext.afterSnapshot)

  return {
    source: "debug_sms_test",
    message_id: typeof afterSnapshot?.message_id === "string" ? afterSnapshot.message_id : null,
    status: typeof afterSnapshot?.status === "string" ? afterSnapshot.status : null,
  }
}

async function post(request: Request) {
  const configuredSecret = process.env.CRON_SHARED_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim() ?? ""

  if (!configuredSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SHARED_SECRET is not configured" }, { status: 500 })
  }

  if (!providedSecret || !secureEquals(providedSecret, configuredSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 })
  }

  const body = asObject(payload)
  if (!body) {
    return NextResponse.json({ ok: false, error: "body must be an object" }, { status: 400 })
  }

  const to = asString(body.to)
  const smsBody = asString(body.body)
  if (!to || !smsBody) {
    return NextResponse.json(
      { ok: false, error: "body must include non-empty string fields: to, body" },
      { status: 400 },
    )
  }

  try {
    const result = await sendSms(to, smsBody)
    return NextResponse.json({
      ok: true,
      message_id: result.message_id,
      status: result.status,
    })
  } catch (error) {
    const message = getErrorMessage(error)
    const httpStatus = getErrorHttpStatus(error)
    const responseBody = getErrorResponseBody(error)

    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(typeof httpStatus === "number" ? { http_status: httpStatus } : {}),
        ...(typeof responseBody === "string" ? { response_body: responseBody } : {}),
      },
      { status: 500 },
    )
  }
}

export const POST = withAuditTrail(post, {
  actor: "system",
  entity_type: "SmsTest",
  action: "CREATE",
  afterFn: responseJsonSnapshot,
  entityIdFn: () => null,
  metadataFn: smsTestMetadata,
})
