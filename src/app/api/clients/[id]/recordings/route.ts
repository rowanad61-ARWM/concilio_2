import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import {
  loadFileNoteSnapshot,
  responseFileNoteId,
} from "@/lib/document-note-audit-snapshots"
import { db } from "@/lib/db"
import { uploadFile } from "@/lib/graph"
import {
  findAccessibleClientParty,
  isUuid,
  resolveActiveHouseholdId,
  resolveSessionActorUserId,
} from "@/lib/timeline-api"
import { writeTimelineEntry } from "@/lib/timeline"

type RecordingRouteContext = {
  params: Promise<{ id: string }>
}

const PLACEHOLDER_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const MAX_RECORDING_BYTES = 250 * 1024 * 1024

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:"*?<>|]+/g, "_").replace(/\s+/g, " ").trim()
}

function extensionForMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes("ogg")) {
    return "ogg"
  }
  if (normalized.includes("mp4") || normalized.includes("mpeg")) {
    return "m4a"
  }
  return "webm"
}

function parseOptionalUuid(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed && isUuid(trimmed) ? trimmed : null
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

async function resolveEngagementId(params: {
  rawEngagementId: string | null
  partyId: string
  householdId: string | null
}) {
  if (!params.rawEngagementId) {
    return null
  }

  const engagement = await db.engagement.findFirst({
    where: {
      id: params.rawEngagementId,
      OR: [
        { party_id: params.partyId },
        ...(params.householdId ? [{ household_id: params.householdId }] : []),
      ],
    },
    select: {
      id: true,
    },
  })

  return engagement?.id ?? null
}

async function uploadRecording(
  request: Request,
  { params }: RecordingRouteContext,
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id: partyId } = await params
  const party = await findAccessibleClientParty(partyId)
  if (!party) {
    return NextResponse.json({ error: "client not found" }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 })
  }

  const fileValue = formData.get("recording")
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "recording file is required" }, { status: 400 })
  }

  if (fileValue.size <= 0) {
    return NextResponse.json({ error: "recording file is empty" }, { status: 400 })
  }

  if (fileValue.size > MAX_RECORDING_BYTES) {
    return NextResponse.json({ error: "recording file is too large" }, { status: 413 })
  }

  const [householdId, actorUserId] = await Promise.all([
    resolveActiveHouseholdId(party.id),
    resolveSessionActorUserId(session),
  ])
  const engagementId = await resolveEngagementId({
    rawEngagementId: parseOptionalUuid(formData.get("engagement_id")),
    partyId: party.id,
    householdId,
  })
  const durationSeconds = parseOptionalNumber(formData.get("duration_seconds"))
  const isPartial = formData.get("is_partial") === "true"
  const extension = extensionForMimeType(fileValue.type || fileValue.name)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const fallbackFilename = `${party.display_name || "Client"} recording ${timestamp}.${extension}`
  const filename = sanitizeFilename(fileValue.name || fallbackFilename) || fallbackFilename
  const fileBuffer = Buffer.from(await fileValue.arrayBuffer())

  try {
    const uploaded = await uploadFile(party.id, "Meetings", filename, fileBuffer)
    const recordingUrl = uploaded.webUrl ?? uploaded["@microsoft.graph.downloadUrl"] ?? uploaded.id
    const noteText = [
      isPartial
        ? "Partial recording uploaded. Transcript pending."
        : "Recording uploaded. Transcript pending.",
      engagementId ? `Engagement: ${engagementId}` : null,
      durationSeconds !== null ? `Duration: ${Math.round(durationSeconds)} seconds` : null,
      `SharePoint file: ${uploaded.name}`,
    ]
      .filter(Boolean)
      .join("\n")

    const { note, processingJob } = await db.$transaction(async (tx) => {
      const createdNote = await tx.file_note.create({
        data: {
          party_id: party.id,
          household_id: householdId,
          engagement_id: engagementId,
          note_type: "meeting",
          text: noteText,
          recording_url: recordingUrl,
          source_type: "transcript",
          review_state: "draft",
          author_user_id: actorUserId ?? PLACEHOLDER_AUTHOR_ID,
          created_at: new Date(),
        },
      })

      const createdJob = await tx.processing_job.create({
        data: {
          job_type: "transcribe_recording",
          payload: {
            file_note_id: createdNote.id,
            recording_url: recordingUrl,
            party_id: party.id,
            engagement_id: engagementId,
            sharepoint_drive_item_id: uploaded.id,
          },
        },
      })

      return { note: createdNote, processingJob: createdJob }
    })

    await writeTimelineEntry({
      party_id: party.id,
      household_id: householdId,
      kind: "file_note",
      title: isPartial ? "Partial recording uploaded" : "Recording uploaded",
      body: noteText,
      actor_user_id: actorUserId,
      related_entity_type: "file_note",
      related_entity_id: note.id,
      occurred_at: note.created_at,
      metadata: {
        source_type: "transcript",
        review_state: "draft",
        recording_url: recordingUrl,
        sharepoint_drive_item_id: uploaded.id,
        filename: uploaded.name,
        size_bytes: uploaded.size,
        mime_type: fileValue.type || null,
        duration_seconds: durationSeconds,
        engagement_id: engagementId,
        is_partial: isPartial,
        processing_job_id: processingJob.id,
      },
    })

    return NextResponse.json(
      {
        id: note.id,
        fileNote: note,
        recording: uploaded,
        processingJob,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[recording upload error]", error)
    return NextResponse.json({ error: "failed to upload recording" }, { status: 500 })
  }
}

export const POST = withAuditTrail<RecordingRouteContext>(uploadRecording, {
  entity_type: "file_note",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseFileNoteId(auditContext)
    return id ? loadFileNoteSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) =>
    responseFileNoteId(auditContext),
})
