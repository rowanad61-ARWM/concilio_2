import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { sendMailAsAdviser } from "@/lib/graphMail"

const REVIEW_JOB_TYPES = ["generate_file_note", "extract_tasks", "extract_facts"] as const

type ReviewJobType = (typeof REVIEW_JOB_TYPES)[number]

type ReviewJobStatus = {
  id: string
  job_type: ReviewJobType
  status: string
  error_message: string | null
  completed_at: Date | null
}

function isReviewJobType(value: string): value is ReviewJobType {
  return (REVIEW_JOB_TYPES as readonly string[]).includes(value)
}

function jsonObject(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function absoluteUrl(path: string) {
  const configured =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim()

  if (!configured) {
    return path
  }

  const origin = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return `${origin.replace(/\/+$/, "")}${path}`
}

export async function loadLatestReviewJobStatuses(fileNoteId: string) {
  const rows = await db.$queryRaw<ReviewJobStatus[]>`
    SELECT DISTINCT ON (job_type)
      id,
      job_type,
      status,
      error_message,
      completed_at
    FROM public.processing_job
    WHERE job_type IN ('generate_file_note', 'extract_tasks', 'extract_facts')
      AND payload->>'file_note_id' = ${fileNoteId}
    ORDER BY job_type, created_at DESC
  `

  return rows.filter((row): row is ReviewJobStatus => isReviewJobType(row.job_type))
}

export async function notifyFileNoteReviewReady(params: { fileNoteId: string }) {
  const fileNote = await db.file_note.findUnique({
    where: { id: params.fileNoteId },
    select: {
      id: true,
      party_id: true,
      author_user_id: true,
      party: {
        select: {
          id: true,
          display_name: true,
        },
      },
      engagement: {
        select: {
          id: true,
          primary_adviser_id: true,
          user_account: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      user_account: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!fileNote) {
    console.warn("[file note notification] file_note not found", params.fileNoteId)
    return { notified: false, reason: "file_note_not_found" as const }
  }

  const adviser = fileNote.engagement?.user_account ?? fileNote.user_account
  if (!adviser?.id || !adviser.email) {
    console.warn("[file note notification] no assigned adviser for file_note", params.fileNoteId)
    return { notified: false, reason: "adviser_not_found" as const }
  }

  const clientName = fileNote.party?.display_name ?? "Client"
  const clientId = fileNote.party_id
  const reviewPath = clientId ? `/clients/${clientId}/file-notes/${fileNote.id}/review` : `/admin/alerts`
  const reviewUrl = absoluteUrl(reviewPath)
  const jobs = await loadLatestReviewJobStatuses(fileNote.id)
  const jobsSucceeded = jobs.filter((job) => job.status === "succeeded").map((job) => job.job_type)
  const jobsFailed = jobs.filter((job) => job.status === "failed").map((job) => job.job_type)
  const payload = {
    client_id: clientId,
    client_name: clientName,
    review_url: reviewPath,
    absolute_review_url: reviewUrl,
    jobs_succeeded: jobsSucceeded,
    jobs_failed: jobsFailed,
    job_statuses: jobs.map((job) => ({
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      error_message: job.error_message,
      completed_at: job.completed_at?.toISOString() ?? null,
    })),
  }

  const inserted = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.alert_instance (
      alert_type,
      entity_type,
      entity_id,
      payload,
      recipient_user_id
    )
    VALUES (
      'file_note_review_outstanding',
      'file_note',
      ${fileNote.id}::uuid,
      ${JSON.stringify(payload)}::jsonb,
      ${adviser.id}::uuid
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `

  const alertId = inserted[0]?.id ?? null
  if (!alertId) {
    return { notified: false, reason: "duplicate_alert" as const }
  }

  const warning =
    jobsFailed.length > 0
      ? `\n\nNote: ${jobsFailed.join(", ")} failed. The review screen may need manual attention or a retry.`
      : ""
  const emailBody = [
    `Your file note for ${clientName} is ready to review.`,
    warning.trim(),
    `Review file note: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  try {
    await sendMailAsAdviser({
      toEmail: adviser.email,
      toName: adviser.name,
      subject: `File note ready for review: ${clientName}`,
      htmlBody: emailBody,
      bodyContentType: "Text",
    })
  } catch (error) {
    console.error("[file note notification] Graph email failed", error)
  }

  return {
    notified: true,
    alert_id: alertId,
    adviser_user_id: adviser.id,
    jobs_succeeded: jobsSucceeded,
    jobs_failed: jobsFailed,
    payload: jsonObject(payload),
  }
}
