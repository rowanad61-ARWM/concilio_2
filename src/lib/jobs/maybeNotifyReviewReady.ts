import {
  loadLatestReviewJobStatuses,
  notifyFileNoteGenerationFailed,
  notifyFileNoteReviewReady,
} from "@/lib/notifications/fileNoteReviewReady"

const REQUIRED_JOB_TYPES = ["generate_file_note", "extract_tasks", "extract_facts"] as const
const TERMINAL_STATUSES = new Set(["succeeded", "failed"])

export async function maybeNotifyReviewReady(params: { fileNoteId: string }) {
  const jobs = await loadLatestReviewJobStatuses(params.fileNoteId)
  const jobByType = new Map(jobs.map((job) => [job.job_type, job]))
  const hasAllJobs = REQUIRED_JOB_TYPES.every((jobType) => jobByType.has(jobType))

  if (!hasAllJobs) {
    return { checked: true, notified: false, reason: "waiting_for_jobs" as const }
  }

  const allTerminal = REQUIRED_JOB_TYPES.every((jobType) => {
    const status = jobByType.get(jobType)?.status
    return status ? TERMINAL_STATUSES.has(status) : false
  })

  if (!allTerminal) {
    return { checked: true, notified: false, reason: "jobs_not_terminal" as const }
  }

  if (jobByType.get("generate_file_note")?.status !== "succeeded") {
    console.warn("[file note notification] generate_file_note failed; sending generation-failed alert", {
      file_note_id: params.fileNoteId,
    })
    return notifyFileNoteGenerationFailed({ fileNoteId: params.fileNoteId })
  }

  return notifyFileNoteReviewReady({ fileNoteId: params.fileNoteId })
}
