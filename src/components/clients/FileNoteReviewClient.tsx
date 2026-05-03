"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import FileNoteFactsSection, {
  parseExtractedFacts,
  type ParkOnlyCategoryOption,
  type ReviewFactRow,
} from "@/components/clients/FileNoteFactsSection"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type AttendeeSuggestion = {
  displayName: string
  attendeeType: string
}

type SpeakerSegment = {
  speaker_id: number
  start: number
  end: number
  text: string
}

type FileNoteReviewClientProps = {
  clientId: string
  fileNoteId: string
  clientName: string
  reviewState: string
  recordingUrl: string | null
  generationModel: string | null
  generationPromptVersion: string | null
  generationAt: string | null
  publishedAt: string | null
  publishedByName: string | null
  meetingDate: string | null
  meetingModality: string | null
  speakerSegments: SpeakerSegment[]
  initialSpeakerNameMap: Record<string, string>
  initialTranscriptText: string
  initialDraftContent: string
  aiDraftContent: string | null
  extractedTasks: unknown
  taskExtractionAt: string | null
  taskExtractionModel: string | null
  taskExtractionPromptVersion: string | null
  taskPublishDecisions: unknown
  extractedFacts: unknown
  factExtractionAt: string | null
  factExtractionModel: string | null
  factExtractionPromptVersion: string | null
  factPublishDecisions: unknown
  parkOnlyCategories: ParkOnlyCategoryOption[]
  publishedTasks: PublishedTaskSummary[]
  taskTypeOptions: TaskTypeOptionRow[]
  attendeeSuggestions: AttendeeSuggestion[]
}

type SaveState = "idle" | "saving" | "saved" | "error"

type TaskOwnerSide = "us" | "client"

type TaskTypeOptionRow = {
  type: string
  subtype: string | null
}

type ReviewTaskRow = {
  id: string
  ticked: boolean
  text: string
  owner_side: TaskOwnerSide
  task_type: string | null
  task_subtype: string | null
  due_date: string | null
  source_quote: string | null
}

type PublishedTaskSummary = {
  id: string
  title: string
  type: string
  subtype: string | null
  actorSide: TaskOwnerSide
  dueDate: string | null
  mondaySyncState: string | null
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238] disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]"

const textAreaClassName =
  "w-full resize-y rounded-[10px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-3 text-[13px] leading-[1.6] text-[#113238] outline-none focus:border-[#113238] disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]"

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return "Not recorded"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function formatModality(value: string | null) {
  if (!value) {
    return "Meeting"
  }

  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

function uniqueSpeakerIds(segments: SpeakerSegment[], speakerNameMap: Record<string, string>) {
  const ids = new Set<string>()
  segments.forEach((segment) => ids.add(String(segment.speaker_id)))
  Object.keys(speakerNameMap).forEach((key) => ids.add(key))

  return Array.from(ids).sort((left, right) => Number(left) - Number(right))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function browserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeOwnerSide(value: unknown): TaskOwnerSide {
  return value === "client" ? "client" : "us"
}

function parseExtractedTasks(value: unknown): ReviewTaskRow[] | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((task, index) => {
      if (!isRecord(task)) {
        return null
      }

      const text = nullableString(task.text)
      if (!text) {
        return null
      }

      return {
        id: nullableString(task.id) ?? `extracted-${index}`,
        ticked: true,
        text,
        owner_side: normalizeOwnerSide(task.owner_guess),
        task_type: nullableString(task.task_type_guess),
        task_subtype: nullableString(task.task_subtype_guess),
        due_date: nullableString(task.due_date_guess),
        source_quote: nullableString(task.source_quote),
      }
    })
    .filter((task): task is ReviewTaskRow => Boolean(task))
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return value
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function truncateText(value: string, maxLength = 130) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function statusText(state: SaveState) {
  if (state === "saving") return "Saving..."
  if (state === "saved") return "Saved"
  if (state === "error") return "Could not save"
  return null
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-5 py-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#113238]">{title}</h2>
          {description ? <p className="mt-1 text-[12px] leading-[1.5] text-[#6b7280]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function FileNoteReviewClient({
  clientId,
  fileNoteId,
  clientName,
  reviewState,
  recordingUrl,
  generationModel,
  generationPromptVersion,
  generationAt,
  publishedAt,
  publishedByName,
  meetingDate,
  meetingModality,
  speakerSegments,
  initialSpeakerNameMap,
  initialTranscriptText,
  initialDraftContent,
  aiDraftContent,
  extractedTasks,
  taskExtractionAt,
  taskExtractionModel,
  taskExtractionPromptVersion,
  taskPublishDecisions,
  extractedFacts,
  factExtractionAt,
  factExtractionModel,
  factExtractionPromptVersion,
  factPublishDecisions,
  parkOnlyCategories,
  publishedTasks,
  taskTypeOptions,
  attendeeSuggestions,
}: FileNoteReviewClientProps) {
  const router = useRouter()
  const isPublished = reviewState === "published"
  const [speakerNameMap, setSpeakerNameMap] = useState(initialSpeakerNameMap)
  const [transcriptText, setTranscriptText] = useState(initialTranscriptText)
  const [draftContent, setDraftContent] = useState(initialDraftContent)
  const [speakerSaveState, setSpeakerSaveState] = useState<SaveState>("idle")
  const [transcriptSaveState, setTranscriptSaveState] = useState<SaveState>("idle")
  const [draftSaveState, setDraftSaveState] = useState<SaveState>("idle")
  const [serverError, setServerError] = useState<string | null>(null)
  const [regenDialogOpen, setRegenDialogOpen] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [jobMessage, setJobMessage] = useState<string | null>(null)
  const extractedTasksKey = JSON.stringify(extractedTasks ?? null)
  const extractedFactsKey = JSON.stringify(extractedFacts ?? null)
  const initialTaskRows = useMemo(() => parseExtractedTasks(extractedTasks), [extractedTasksKey])
  const initialFactRows = useMemo(() => parseExtractedFacts(extractedFacts, parkOnlyCategories), [extractedFactsKey, parkOnlyCategories])
  const [taskRows, setTaskRows] = useState<ReviewTaskRow[] | null>(initialTaskRows)
  const [factRows, setFactRows] = useState<ReviewFactRow[] | null>(initialFactRows)

  const speakerIds = useMemo(() => uniqueSpeakerIds(speakerSegments, speakerNameMap), [speakerNameMap, speakerSegments])
  const attendeeListId = `attendee-suggestions-${fileNoteId}`
  const taskTypes = useMemo(() => Array.from(new Set(taskTypeOptions.map((option) => option.type))).sort(), [taskTypeOptions])
  const subtypesByType = useMemo(() => {
    const map = new Map<string, string[]>()
    taskTypeOptions.forEach((option) => {
      if (!option.subtype) {
        return
      }

      const current = map.get(option.type) ?? []
      current.push(option.subtype)
      map.set(option.type, current)
    })

    return map
  }, [taskTypeOptions])
  const acceptedTaskCount = taskRows?.filter((task) => task.ticked && task.text.trim()).length ?? 0
  const taskDecisionCount = Array.isArray(taskPublishDecisions) ? taskPublishDecisions.length : null
  const taskExtractionDescription = taskExtractionAt
    ? `Extracted ${formatDateTime(taskExtractionAt)}${taskExtractionModel ? ` by ${taskExtractionModel}` : ""}${
        taskExtractionPromptVersion ? ` (${taskExtractionPromptVersion})` : ""
      }.`
    : "Review AI-suggested follow-up tasks before publishing."
  const factExtractionDescription = factExtractionAt
    ? `Extracted ${formatDateTime(factExtractionAt)}${factExtractionModel ? ` by ${factExtractionModel}` : ""}${
        factExtractionPromptVersion ? ` (${factExtractionPromptVersion})` : ""
      }.`
    : "Review AI-suggested client facts before publishing."

  useEffect(() => {
    if (isPublished) {
      return
    }

    setTaskRows(initialTaskRows)
    setFactRows(initialFactRows)
  }, [fileNoteId, initialFactRows, initialTaskRows, isPublished])

  useEffect(() => {
    if (isPublished || (extractedTasks !== null && extractedFacts !== null)) {
      return
    }

    const timer = window.setInterval(() => router.refresh(), 10_000)
    return () => window.clearInterval(timer)
  }, [extractedFacts, extractedTasks, isPublished, router])

  function updateSpeakerName(speakerId: string, value: string) {
    setSpeakerNameMap((current) => ({
      ...current,
      [speakerId]: value,
    }))
  }

  async function patchJson(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed")
    }
    return payload
  }

  function updateTaskRow(id: string, patch: Partial<ReviewTaskRow>) {
    setTaskRows((current) => {
      if (!current) {
        return current
      }

      return current.map((task) => {
        if (task.id !== id) {
          return task
        }

        const next = { ...task, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, "task_type")) {
          const allowedSubtypes = next.task_type ? subtypesByType.get(next.task_type) ?? [] : []
          if (next.task_subtype && !allowedSubtypes.includes(next.task_subtype)) {
            next.task_subtype = null
          }
        }

        return next
      })
    })
  }

  function addTaskRow() {
    setTaskRows((current) => [
      ...(current ?? []),
      {
        id: browserId(),
        ticked: true,
        text: "",
        owner_side: "us",
        task_type: null,
        task_subtype: null,
        due_date: null,
        source_quote: null,
      },
    ])
  }

  async function saveSpeakers() {
    if (isPublished) return

    setServerError(null)
    setSpeakerSaveState("saving")
    try {
      await patchJson(`/api/file-notes/${encodeURIComponent(fileNoteId)}/transcript`, {
        speaker_name_map: speakerNameMap,
      })
      setSpeakerSaveState("saved")
      router.refresh()
    } catch (error) {
      setSpeakerSaveState("error")
      setServerError(error instanceof Error ? error.message : "Could not save speakers")
    }
  }

  async function saveTranscript() {
    if (isPublished) return

    setServerError(null)
    setTranscriptSaveState("saving")
    try {
      await patchJson(`/api/file-notes/${encodeURIComponent(fileNoteId)}/transcript`, {
        transcript_text: transcriptText,
      })
      setTranscriptSaveState("saved")
      router.refresh()
    } catch (error) {
      setTranscriptSaveState("error")
      setServerError(error instanceof Error ? error.message : "Could not save transcript")
    }
  }

  async function saveDraft() {
    if (isPublished) return

    setServerError(null)
    setDraftSaveState("saving")
    try {
      await patchJson(`/api/file-notes/${encodeURIComponent(fileNoteId)}/draft`, {
        content: draftContent,
      })
      setDraftSaveState("saved")
      router.refresh()
    } catch (error) {
      setDraftSaveState("error")
      setServerError(error instanceof Error ? error.message : "Could not save draft")
    }
  }

  async function regenerate() {
    if (isPublished || isRegenerating) return

    setServerError(null)
    setJobMessage(null)
    setIsRegenerating(true)
    try {
      const response = await fetch(`/api/file-notes/${encodeURIComponent(fileNoteId)}/regenerate`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string; processing_job_id?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not queue regeneration")
      }

      setDraftContent("")
      setJobMessage(`Regeneration queued${payload.processing_job_id ? ` (${payload.processing_job_id})` : ""}.`)
      setTimeout(() => router.refresh(), 7000)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not queue regeneration")
    } finally {
      setIsRegenerating(false)
      setRegenDialogOpen(false)
    }
  }

  async function publish() {
    if (isPublished || isPublishing) return

    setServerError(null)
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/file-notes/${encodeURIComponent(fileNoteId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(taskRows ? { tasks: taskRows } : {}),
          ...(factRows ? { facts: factRows } : {}),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not publish file note")
      }

      setPublishDialogOpen(false)
      router.refresh()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not publish file note")
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-6 py-6">
      <div className="rounded-[12px] border-[0.5px] border-[#dbe3e8] bg-white px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <a href={`/clients/${clientId}`} className="text-[12px] font-medium text-[#6b7280] underline-offset-2 hover:underline">
              Back to client record
            </a>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[0px] text-[#113238]">File note review</h1>
            <p className="mt-1 text-[13px] text-[#6b7280]">{clientName}</p>
          </div>
          <div className="grid gap-1 text-[12px] text-[#6b7280] lg:min-w-[320px]">
            <p>
              <span className="font-medium text-[#113238]">Meeting:</span> {formatDateTime(meetingDate)} -{" "}
              {formatModality(meetingModality)}
            </p>
            <p>
              <span className="font-medium text-[#113238]">Generated:</span> {formatDateTime(generationAt)}
            </p>
            <p>
              <span className="font-medium text-[#113238]">Model:</span> {generationModel ?? "Not recorded"}
              {generationPromptVersion ? ` (${generationPromptVersion})` : ""}
            </p>
            {recordingUrl ? (
              <a href={recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-[#113238] underline-offset-2 hover:underline">
                Open recording
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {isPublished ? (
        <div className="rounded-[10px] border-[0.5px] border-[#cfe3d8] bg-[#f3faf6] px-4 py-3 text-[13px] text-[#0f5c3a]">
          Already published. Edits go through the standard file_note edit path.
          {publishedAt ? ` Published ${formatDateTime(publishedAt)}` : ""}
          {publishedByName ? ` by ${publishedByName}.` : "."}
        </div>
      ) : null}

      {serverError ? (
        <div className="rounded-[10px] border-[0.5px] border-[#f9caca] bg-[#fff7f7] px-4 py-3 text-[13px] text-[#B42318]">
          {serverError}
        </div>
      ) : null}

      {jobMessage ? (
        <div className="rounded-[10px] border-[0.5px] border-[#dbe3e8] bg-white px-4 py-3 text-[13px] text-[#113238]">
          {jobMessage} Refresh after the next cron tick to see the new draft.
        </div>
      ) : null}

      <Section
        title="Speakers"
        description="Rename speakers from the transcript. Suggestions come from structured Calendly attendees where available, but free text is accepted."
        action={
          !isPublished ? (
            <div className="flex items-center gap-2">
              {statusText(speakerSaveState) ? <span className="text-[12px] text-[#6b7280]">{statusText(speakerSaveState)}</span> : null}
              <button
                type="button"
                onClick={() => void saveSpeakers()}
                className="rounded-[7px] bg-[#113238] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
                disabled={speakerSaveState === "saving"}
              >
                Save speakers
              </button>
            </div>
          ) : null
        }
      >
        <datalist id={attendeeListId}>
          {attendeeSuggestions.map((attendee) => (
            <option key={`${attendee.displayName}-${attendee.attendeeType}`} value={attendee.displayName} />
          ))}
        </datalist>

        {speakerIds.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {speakerIds.map((speakerId) => (
              <label key={speakerId} className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Speaker {speakerId}</span>
                <input
                  list={attendeeListId}
                  value={speakerNameMap[speakerId] ?? `Speaker ${speakerId}`}
                  onChange={(event) => updateSpeakerName(speakerId, event.target.value)}
                  disabled={isPublished}
                  className={inputClassName}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#9ca3af]">No speaker segments were detected.</p>
        )}
      </Section>

      <Section
        title="Transcript"
        description="Edit the full transcript text used for regeneration. Segment timings are preserved separately for future polish."
        action={
          !isPublished ? (
            <div className="flex items-center gap-2">
              {statusText(transcriptSaveState) ? <span className="text-[12px] text-[#6b7280]">{statusText(transcriptSaveState)}</span> : null}
              <button
                type="button"
                onClick={() => void saveTranscript()}
                className="rounded-[7px] bg-[#113238] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
                disabled={transcriptSaveState === "saving"}
              >
                Save transcript
              </button>
            </div>
          ) : null
        }
      >
        <textarea
          value={transcriptText}
          onChange={(event) => setTranscriptText(event.target.value)}
          disabled={isPublished}
          rows={14}
          className={`${textAreaClassName} font-mono`}
        />
      </Section>

      <Section
        title="Draft file note"
        description="This is the adviser-edited version. The original AI draft stays preserved for audit when publishing."
        action={
          !isPublished ? (
            <div className="flex items-center gap-2">
              {statusText(draftSaveState) ? <span className="text-[12px] text-[#6b7280]">{statusText(draftSaveState)}</span> : null}
              <button
                type="button"
                onClick={() => void saveDraft()}
                className="rounded-[7px] bg-[#113238] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
                disabled={draftSaveState === "saving"}
              >
                Save draft
              </button>
            </div>
          ) : null
        }
      >
        <textarea
          value={draftContent}
          onChange={(event) => setDraftContent(event.target.value)}
          disabled={isPublished}
          rows={12}
          className={textAreaClassName}
          placeholder={aiDraftContent ? "AI draft available after refresh" : "No draft has been generated yet."}
        />
      </Section>

      <Section
        title="Tasks"
        description={taskExtractionDescription}
        action={
          !isPublished && taskRows !== null ? (
            <button
              type="button"
              onClick={addTaskRow}
              className="rounded-[7px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[12px] font-medium text-[#113238] hover:bg-[#f7fafb]"
            >
              + Add task
            </button>
          ) : null
        }
      >
        {isPublished ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[#6b7280]">
              {publishedTasks.length > 0
                ? `${publishedTasks.length} task${publishedTasks.length === 1 ? "" : "s"} published from this note.`
                : taskDecisionCount
                  ? `${taskDecisionCount} task decision${taskDecisionCount === 1 ? "" : "s"} captured; no task rows were created.`
                  : "No tasks were published from this note."}
            </p>
            {publishedTasks.length > 0 ? (
              <div className="space-y-2">
                {publishedTasks.map((task) => (
                  <div key={task.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
                    <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-[#113238]">{task.title}</p>
                        <p className="mt-1 text-[12px] text-[#6b7280]">
                          {task.actorSide === "client" ? "Client" : "Us"} - {task.type}
                          {task.subtype ? ` / ${task.subtype}` : ""}
                          {task.dueDate ? ` - due ${formatDateOnly(task.dueDate)}` : ""}
                        </p>
                      </div>
                      {task.mondaySyncState ? (
                        <span className="rounded-full border-[0.5px] border-[#dbe3e8] bg-white px-2 py-1 text-[11px] text-[#6b7280]">
                          Monday: {task.mondaySyncState}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : taskRows === null ? (
          <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
            <p className="text-[13px] text-[#6b7280]">Task extraction not yet complete.</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-3 rounded-[7px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[12px] font-medium text-[#113238] hover:bg-[#f7fafb]"
            >
              Refresh
            </button>
          </div>
        ) : taskRows.length === 0 ? (
          <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
            <p className="text-[13px] text-[#6b7280]">No follow-up tasks detected in this conversation.</p>
            <button
              type="button"
              onClick={addTaskRow}
              className="mt-3 rounded-[7px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[12px] font-medium text-[#113238] hover:bg-[#f7fafb]"
            >
              + Add task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-[#6b7280]">
              {acceptedTaskCount} task{acceptedTaskCount === 1 ? "" : "s"} currently ticked for publish.
            </p>
            {taskRows.map((task) => {
              const subtypeOptions = task.task_type ? subtypesByType.get(task.task_type) ?? [] : []
              return (
                <div key={task.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
                  <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
                    <label className="flex items-center gap-2 text-[12px] font-medium text-[#113238]">
                      <input
                        type="checkbox"
                        checked={task.ticked}
                        onChange={(event) => updateTaskRow(task.id, { ticked: event.target.checked })}
                        className="h-4 w-4 rounded border-[#dbe3e8]"
                      />
                      Include
                    </label>
                    <div className="space-y-3">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Task</span>
                        <input
                          value={task.text}
                          onChange={(event) => updateTaskRow(task.id, { text: event.target.value })}
                          className={inputClassName}
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Owner</span>
                          <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border-[0.5px] border-[#dbe3e8] bg-white">
                            {(["us", "client"] as TaskOwnerSide[]).map((side) => (
                              <button
                                key={side}
                                type="button"
                                onClick={() => updateTaskRow(task.id, { owner_side: side })}
                                className={`px-3 py-2 text-[12px] font-medium ${
                                  task.owner_side === side ? "bg-[#113238] text-white" : "text-[#6b7280] hover:bg-[#f7fafb]"
                                }`}
                              >
                                {side === "us" ? "Us" : "Client"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Type</span>
                          <select
                            value={task.task_type ?? ""}
                            onChange={(event) => updateTaskRow(task.id, { task_type: event.target.value || null })}
                            className={inputClassName}
                          >
                            <option value="">No type</option>
                            {taskTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Subtype</span>
                          <select
                            value={task.task_subtype ?? ""}
                            onChange={(event) => updateTaskRow(task.id, { task_subtype: event.target.value || null })}
                            disabled={!task.task_type || subtypeOptions.length === 0}
                            className={inputClassName}
                          >
                            <option value="">No subtype</option>
                            {subtypeOptions.map((subtype) => (
                              <option key={subtype} value={subtype}>
                                {subtype}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Due date</span>
                          <input
                            type="date"
                            value={task.due_date ?? ""}
                            onChange={(event) => updateTaskRow(task.id, { due_date: event.target.value || null })}
                            className={inputClassName}
                          />
                        </label>
                      </div>
                      {task.source_quote ? (
                        <p className="text-[12px] italic leading-[1.5] text-[#6b7280]">
                          Source: "{truncateText(task.source_quote, 220)}"
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <FileNoteFactsSection
        isPublished={isPublished}
        factRows={factRows}
        factPublishDecisions={factPublishDecisions}
        parkOnlyCategories={parkOnlyCategories}
        description={factExtractionDescription}
        onRefresh={() => router.refresh()}
        onChange={setFactRows}
      />

      <div className="sticky bottom-0 flex justify-end gap-2 border-t-[0.5px] border-[#dbe3e8] bg-[#F7F9FB]/95 px-1 py-3">
        <button
          type="button"
          onClick={() => setRegenDialogOpen(true)}
          disabled={isPublished || isRegenerating}
          className="rounded-[8px] border-[0.5px] border-[#dbe3e8] bg-white px-4 py-2 text-[13px] font-medium text-[#113238] disabled:opacity-50"
        >
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => setPublishDialogOpen(true)}
          disabled={isPublished || isPublishing}
          className="rounded-[8px] bg-[#113238] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          Publish
        </button>
      </div>

      <AlertDialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate file note?</AlertDialogTitle>
            <AlertDialogDescription>
              Regenerating will replace the current AI draft with a fresh version. Your edits to the draft will be lost. Your transcript edits and speaker names will be used as input to the new draft. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isRegenerating} onClick={() => void regenerate()}>
              {isRegenerating ? "Queuing..." : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish file note?</AlertDialogTitle>
            <AlertDialogDescription>
              Publish this file note? It will appear on the timeline as the official record of this meeting. The original AI draft is preserved for audit.
              {taskRows === null
                ? " Task extraction is not complete yet, so no tasks will be created from this publish."
                : ` ${acceptedTaskCount} task${acceptedTaskCount === 1 ? "" : "s"} will be created.`}
              {factRows === null
                ? " Fact extraction is not complete yet, so no facts will be updated or parked."
                : ` ${factRows.length} fact decision${factRows.length === 1 ? "" : "s"} will be captured.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isPublishing} onClick={() => void publish()}>
              {isPublishing ? "Publishing..." : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
