import type { Prisma } from "@prisma/client"

import { submitTranscriptionJob, waitForTranscriptionResult } from "@/lib/azureSpeech"
import { db } from "@/lib/db"
import { getFileById } from "@/lib/graph"
import type { SpeakerSegment } from "@/types/transcription"

type TranscribeRecordingPayload = {
  file_note_id: string
  recording_url: string
  party_id: string
  engagement_id?: string | null
  sharepoint_drive_item_id?: string | null
}

export type TranscribeRecordingResult = {
  azure_transcription_job_id: string
  meeting_transcript_id: string
  segment_count: number
  duration_seconds: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`transcribe_recording payload missing ${key}`)
  }
  return value.trim()
}

function optionalString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function parsePayload(payload: Prisma.JsonValue): TranscribeRecordingPayload {
  if (!isRecord(payload)) {
    throw new Error("transcribe_recording payload must be an object")
  }

  return {
    file_note_id: requiredString(payload, "file_note_id"),
    recording_url: requiredString(payload, "recording_url"),
    party_id: requiredString(payload, "party_id"),
    engagement_id: optionalString(payload, "engagement_id"),
    sharepoint_drive_item_id: optionalString(payload, "sharepoint_drive_item_id"),
  }
}

function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function resolveTranscriptionContentUrl(payload: TranscribeRecordingPayload) {
  if (payload.sharepoint_drive_item_id) {
    const file = await getFileById(payload.sharepoint_drive_item_id)
    const downloadUrl = file?.["@microsoft.graph.downloadUrl"]
    if (!downloadUrl) {
      throw new Error("SharePoint recording did not expose a direct Graph download URL")
    }
    return downloadUrl
  }

  if (!/^https:\/\//i.test(payload.recording_url)) {
    throw new Error("recording_url must be HTTPS for Azure Speech batch transcription")
  }

  if (/sharepoint\.com/i.test(payload.recording_url) && !/[?&](download|e=|tempauth)=/i.test(payload.recording_url)) {
    throw new Error(
      "SharePoint web URLs are not direct audio URLs. Queue payload must include sharepoint_drive_item_id or a direct download URL.",
    )
  }

  return payload.recording_url
}

function buildSpeakerNameMap(segments: SpeakerSegment[], attendeeNames: string[]) {
  const speakerIds = Array.from(new Set(segments.map((segment) => segment.speaker_id))).sort((a, b) => a - b)
  return Object.fromEntries(
    speakerIds.map((speakerId, index) => [
      String(speakerId),
      attendeeNames[index] || `Speaker ${speakerId}`,
    ]),
  )
}

export async function transcribeRecordingJob(payloadJson: Prisma.JsonValue): Promise<TranscribeRecordingResult> {
  const payload = parsePayload(payloadJson)

  const fileNote = await db.file_note.findFirst({
    where: {
      id: payload.file_note_id,
      party_id: payload.party_id,
    },
    select: {
      id: true,
      recording_url: true,
      transcript_id: true,
    },
  })

  if (!fileNote) {
    throw new Error("source file_note not found for transcribe_recording job")
  }

  if (fileNote.transcript_id) {
    return {
      azure_transcription_job_id: "already-linked",
      meeting_transcript_id: fileNote.transcript_id,
      segment_count: 0,
      duration_seconds: null,
    }
  }

  const [engagement, attendees] = await Promise.all([
    payload.engagement_id
      ? db.engagement.findUnique({
          where: { id: payload.engagement_id },
          select: {
            id: true,
            calendly_event_uuid: true,
          },
        })
      : null,
    payload.engagement_id
      ? db.meeting_attendee.findMany({
          where: { engagement_id: payload.engagement_id },
          orderBy: { created_at: "asc" },
          select: { display_name: true },
        })
      : [],
  ])

  const contentUrl = await resolveTranscriptionContentUrl(payload)
  const { jobId } = await submitTranscriptionJob(contentUrl, {
    displayName: `Concilio file note ${payload.file_note_id}`,
  })
  const result = await waitForTranscriptionResult(jobId)
  const speakerNameMap = buildSpeakerNameMap(
    result.speaker_segments,
    attendees.map((attendee) => attendee.display_name).filter(Boolean),
  )

  const transcript = await db.$transaction(async (tx) => {
    const created = await tx.meeting_transcript.create({
      data: {
        transcript_text: result.text,
        speaker_segments: toJsonCompatible(result.speaker_segments),
        speaker_name_map: toJsonCompatible(speakerNameMap),
        recording_url: fileNote.recording_url ?? payload.recording_url,
        transcription_model: "azure-speech",
        transcription_at: new Date(),
        engagement_id: engagement?.id ?? null,
        calendly_event_uuid: engagement?.calendly_event_uuid ?? null,
      },
      select: { id: true },
    })

    await tx.file_note.update({
      where: { id: payload.file_note_id },
      data: { transcript_id: created.id },
    })

    await tx.processing_job.create({
      data: {
        job_type: "generate_file_note",
        payload: {
          file_note_id: payload.file_note_id,
        },
      },
    })

    return created
  })

  return {
    azure_transcription_job_id: jobId,
    meeting_transcript_id: transcript.id,
    segment_count: result.speaker_segments.length,
    duration_seconds: result.duration_seconds,
  }
}
