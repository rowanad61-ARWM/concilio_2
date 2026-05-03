import { timingSafeEqual } from "node:crypto"

import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { extractFactsJob } from "@/lib/jobs/extractFacts"
import { extractTasksJob } from "@/lib/jobs/extractTasks"
import { generateFileNoteJob } from "@/lib/jobs/generateFileNote"
import { maybeNotifyReviewReady } from "@/lib/jobs/maybeNotifyReviewReady"
import { transcribeRecordingJob } from "@/lib/jobs/transcribeRecording"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ProcessingJobClaim = {
  id: string
  job_type: string
  payload: Prisma.JsonValue
  attempts: number
  max_attempts: number
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function authenticateCronRequest(request: Request) {
  const configuredSecret = process.env.CRON_SHARED_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim() ?? ""
  const authHeader = request.headers.get("authorization")?.trim() ?? ""

  if (!configuredSecret) {
    console.error("[jobs process] missing CRON_SHARED_SECRET or CRON_SECRET")
    return NextResponse.json({ error: "cron secret not configured" }, { status: 500 })
  }

  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : ""
  const isAuthorized =
    (providedSecret && secureEquals(providedSecret, configuredSecret)) ||
    (bearerToken && secureEquals(bearerToken, configuredSecret))

  if (!isAuthorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return null
}

async function claimNextJob() {
  const jobs = await db.$queryRaw<ProcessingJobClaim[]>`
    UPDATE public.processing_job
    SET
      status = 'running',
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = (
      SELECT id
      FROM public.processing_job
      WHERE status = 'queued'
        AND scheduled_at <= now()
      ORDER BY scheduled_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, job_type, payload, attempts, max_attempts
  `

  return jobs[0] ?? null
}

function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown processing job error"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function reviewReadyFileNoteId(job: ProcessingJobClaim) {
  if (!["generate_file_note", "extract_tasks", "extract_facts"].includes(job.job_type)) {
    return null
  }

  if (!isRecord(job.payload)) {
    return null
  }

  const fileNoteId = job.payload.file_note_id
  return typeof fileNoteId === "string" && fileNoteId.trim() ? fileNoteId.trim() : null
}

async function maybeNotifyAfterTerminalJob(job: ProcessingJobClaim) {
  const fileNoteId = reviewReadyFileNoteId(job)
  if (!fileNoteId) {
    return null
  }

  try {
    return await maybeNotifyReviewReady({ fileNoteId })
  } catch (error) {
    console.error("[jobs process] review-ready notification check failed", {
      job_id: job.id,
      job_type: job.job_type,
      file_note_id: fileNoteId,
      error,
    })
    return null
  }
}

function retryDelayMs(attempts: number) {
  return 60_000 * 2 ** Math.max(attempts - 1, 0)
}

async function dispatchJob(job: ProcessingJobClaim) {
  if (job.job_type === "transcribe_recording") {
    return transcribeRecordingJob(job.payload)
  }

  if (job.job_type === "generate_file_note") {
    return generateFileNoteJob(job.payload)
  }

  if (job.job_type === "extract_tasks") {
    return extractTasksJob(job.payload)
  }

  if (job.job_type === "extract_facts") {
    return extractFactsJob(job.payload)
  }

  throw new Error(`unsupported processing job type: ${job.job_type}`)
}

async function processOneJob() {
  const job = await claimNextJob()
  if (!job) {
    return { processed: false, message: "no queued jobs" }
  }

  try {
    const result = await dispatchJob(job)
    await db.processing_job.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        result: toJsonCompatible(result),
        error_message: null,
        completed_at: new Date(),
      },
    })
    const notification = await maybeNotifyAfterTerminalJob(job)

    return {
      processed: true,
      job_id: job.id,
      job_type: job.job_type,
      status: "succeeded",
      result,
      notification,
    }
  } catch (error) {
    const message = errorMessage(error)
    const willRetry = job.attempts < job.max_attempts

    if (willRetry) {
      const scheduledAt = new Date(Date.now() + retryDelayMs(job.attempts))
      await db.processing_job.update({
        where: { id: job.id },
        data: {
          status: "queued",
          error_message: message.slice(0, 4000),
          scheduled_at: scheduledAt,
          started_at: null,
        },
      })

      return {
        processed: true,
        job_id: job.id,
        job_type: job.job_type,
        status: "queued",
        retry_scheduled_at: scheduledAt.toISOString(),
        error: message,
      }
    }

    await db.processing_job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error_message: message.slice(0, 4000),
        completed_at: new Date(),
      },
    })
    const notification = await maybeNotifyAfterTerminalJob(job)

    return {
      processed: true,
      job_id: job.id,
      job_type: job.job_type,
      status: "failed",
      error: message,
      notification,
    }
  }
}

async function handleProcessRequest(request: Request) {
  const authError = authenticateCronRequest(request)
  if (authError) {
    return authError
  }

  const result = await processOneJob()
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  return handleProcessRequest(request)
}

export async function GET(request: Request) {
  return handleProcessRequest(request)
}
