import { notFound } from "next/navigation"

import { auth } from "@/auth"
import FileNoteReviewClient from "@/components/clients/FileNoteReviewClient"
import {
  canReviewFileNote,
  draftContentFromFileNote,
  jsonStringMap,
  parseSpeakerSegments,
  renderTranscriptForReview,
  resolveReviewActor,
} from "@/lib/file-note-review"
import { db } from "@/lib/db"

export default async function FileNoteReviewPage({
  params,
}: {
  params: Promise<{ id: string; fileNoteId: string }>
}) {
  const [{ id: clientId, fileNoteId }, session] = await Promise.all([params, auth()])
  const actor = await resolveReviewActor(session)
  if (!actor) {
    notFound()
  }

  const fileNote = await db.file_note.findUnique({
    where: { id: fileNoteId },
    select: {
      id: true,
      party_id: true,
      text: true,
      recording_url: true,
      source_type: true,
      transcript_id: true,
      generation_model: true,
      generation_prompt_version: true,
      generation_at: true,
      review_state: true,
      ai_draft_content: true,
      published_at: true,
      published_by: true,
      author_user_id: true,
      party: {
        select: {
          id: true,
          display_name: true,
          client_classification: {
            select: {
              assigned_adviser_id: true,
            },
          },
        },
      },
      engagement: {
        select: {
          id: true,
          opened_at: true,
          completed_at: true,
          meeting_modality: true,
          meeting_type_key: true,
          primary_adviser_id: true,
          calendly_event_uuid: true,
          meeting_attendee: {
            orderBy: { created_at: "asc" },
            select: {
              display_name: true,
              attendee_type: true,
            },
          },
        },
      },
      meeting_transcript: {
        select: {
          id: true,
          transcript_text: true,
          speaker_segments: true,
          speaker_name_map: true,
          recording_url: true,
          transcription_model: true,
          transcription_at: true,
          engagement: {
            select: {
              id: true,
              opened_at: true,
              completed_at: true,
              meeting_modality: true,
              meeting_type_key: true,
              primary_adviser_id: true,
              calendly_event_uuid: true,
              meeting_attendee: {
                orderBy: { created_at: "asc" },
                select: {
                  display_name: true,
                  attendee_type: true,
                },
              },
            },
          },
        },
      },
      published_by_user: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!fileNote || fileNote.party_id !== clientId || !fileNote.party) {
    notFound()
  }

  if (!canReviewFileNote(actor, fileNote)) {
    notFound()
  }

  const transcript = fileNote.meeting_transcript
  const speakerSegments = parseSpeakerSegments(transcript?.speaker_segments ?? null)
  const speakerNameMap = jsonStringMap(transcript?.speaker_name_map ?? null)
  const meeting = transcript?.engagement ?? fileNote.engagement
  const attendees = meeting?.meeting_attendee ?? []
  const transcriptText = transcript
    ? renderTranscriptForReview(transcript.transcript_text, speakerSegments, speakerNameMap)
    : ""
  const meetingDate = meeting?.opened_at ?? fileNote.generation_at ?? transcript?.transcription_at ?? null

  return (
    <FileNoteReviewClient
      clientId={clientId}
      fileNoteId={fileNote.id}
      clientName={fileNote.party.display_name}
      reviewState={fileNote.review_state}
      recordingUrl={fileNote.recording_url ?? transcript?.recording_url ?? null}
      generationModel={fileNote.generation_model}
      generationPromptVersion={fileNote.generation_prompt_version}
      generationAt={fileNote.generation_at?.toISOString() ?? null}
      publishedAt={fileNote.published_at?.toISOString() ?? null}
      publishedByName={fileNote.published_by_user?.name ?? null}
      meetingDate={meetingDate?.toISOString() ?? null}
      meetingModality={meeting?.meeting_modality ?? null}
      speakerSegments={speakerSegments}
      initialSpeakerNameMap={speakerNameMap}
      initialTranscriptText={transcriptText}
      initialDraftContent={draftContentFromFileNote(fileNote.text, fileNote.ai_draft_content)}
      aiDraftContent={fileNote.ai_draft_content}
      attendeeSuggestions={attendees.map((attendee) => ({
        displayName: attendee.display_name,
        attendeeType: attendee.attendee_type,
      }))}
    />
  )
}

