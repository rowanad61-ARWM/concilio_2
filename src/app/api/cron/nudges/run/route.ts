import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { runWorkflowNudges } from "@/lib/nudges/run"

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

async function parseDryRunFlag(request: Request) {
  const rawBody = await request.text()
  if (!rawBody.trim()) {
    return false
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new Error("invalid json body")
  }

  if (!payload || typeof payload !== "object") {
    return false
  }

  return (payload as { dry_run?: unknown }).dry_run === true
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SHARED_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim() ?? ""

  if (!configuredSecret) {
    console.error("[nudges cron] missing CRON_SHARED_SECRET")
    return NextResponse.json({ error: "cron secret not configured" }, { status: 500 })
  }

  if (!providedSecret || !secureEquals(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let dryRun = false
  try {
    dryRun = await parseDryRunFlag(request)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "invalid json body" }, { status: 400 })
  }

  try {
    const result = await runWorkflowNudges({ dryRun })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[nudges cron] run failed", error)
    return NextResponse.json({ error: "failed to run nudges" }, { status: 500 })
  }
}
