import { NextResponse } from "next/server"

import { parseCalendlyPayload, verifyCalendlySignature } from "@/lib/calendly"
import {
  handleInviteeCanceled,
  handleInviteeCreated,
  handleRoutingFormSubmission,
} from "@/lib/calendly-webhook"
import { withAuditTrail } from "@/lib/audit-middleware"
import {
  calendlyWebhookAction,
  calendlyWebhookEntityId,
  calendlyWebhookMetadata,
  captureCalendlyWebhookBeforeSnapshot,
  loadCalendlyWebhookAfterSnapshot,
  shouldAuditCalendlyWebhook,
} from "@/lib/webhook-cron-audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function isSignatureHeaderMalformed(header: string | null) {
  if (!header) {
    return true
  }

  const segments = header.split(",").map((segment) => segment.trim())
  const hasTimestamp = segments.some((segment) => /^t=\d+$/.test(segment))
  const hasDigest = segments.some((segment) => /^v1=[0-9a-f]+$/i.test(segment))
  return !hasTimestamp || !hasDigest
}

async function post(request: Request) {
  const rawBody = await request.text()
  const signatureHeader = request.headers.get("Calendly-Webhook-Signature")
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim()
  const sourceIp = request.headers.get("x-forwarded-for") ?? "unknown-ip"

  if (!signingKey) {
    console.error("[calendly webhook] unknown server-misconfigured missing-signing-key")
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 })
  }

  if (!signatureHeader) {
    console.error(`[calendly webhook] unknown signature-missing ${sourceIp}`)
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  if (isSignatureHeaderMalformed(signatureHeader)) {
    console.error(`[calendly webhook] unknown signature-malformed ${sourceIp}`)
    return NextResponse.json({ error: "malformed signature" }, { status: 400 })
  }

  const isSignatureValid = verifyCalendlySignature(rawBody, signatureHeader, signingKey)
  if (!isSignatureValid) {
    console.error(`[calendly webhook] unknown signature-invalid ${sourceIp}`)
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  try {
    const payload = parseCalendlyPayload(rawBody)

    if (payload.event === "invitee.created" || payload.event === "invitee.rescheduled") {
      await handleInviteeCreated(payload)
      return NextResponse.json({ ok: true })
    }

    if (payload.event === "invitee.canceled") {
      await handleInviteeCanceled(payload)
      return NextResponse.json({ ok: true })
    }

    if (payload.event === "routing_form_submission.created") {
      await handleRoutingFormSubmission(payload)
      return NextResponse.json({ ok: true }, { status: 202 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(`[calendly webhook] unknown handler-failed ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }
}

export const POST = withAuditTrail(post, {
  actor: "system",
  entity_type: "engagement",
  action: calendlyWebhookAction,
  beforeFn: captureCalendlyWebhookBeforeSnapshot,
  afterFn: loadCalendlyWebhookAfterSnapshot,
  entityIdFn: calendlyWebhookEntityId,
  metadataFn: calendlyWebhookMetadata,
  shouldAuditFn: shouldAuditCalendlyWebhook,
})
