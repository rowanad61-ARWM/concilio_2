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
import { PARK_ONLY_CATEGORIES } from "@/lib/extractable-facts"

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
      extracted_tasks: true,
      task_extraction_at: true,
      task_extraction_model: true,
      task_extraction_prompt_version: true,
      task_publish_decisions: true,
      extracted_facts: true,
      fact_extraction_at: true,
      fact_extraction_model: true,
      fact_extraction_prompt_version: true,
      fact_publish_decisions: true,
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
      source_tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          subtype: true,
          actor_side: true,
          dueDateStart: true,
          monday_sync_state: true,
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
  const taskTypeRows = await db.taskTypeOption.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { type: "asc" }, { subtype: "asc" }],
    select: {
      type: true,
      subtype: true,
    },
  })

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
      extractedTasks={fileNote.extracted_tasks}
      taskExtractionAt={fileNote.task_extraction_at?.toISOString() ?? null}
      taskExtractionModel={fileNote.task_extraction_model}
      taskExtractionPromptVersion={fileNote.task_extraction_prompt_version}
      taskPublishDecisions={fileNote.task_publish_decisions}
      extractedFacts={fileNote.extracted_facts}
      factExtractionAt={fileNote.fact_extraction_at?.toISOString() ?? null}
      factExtractionModel={fileNote.fact_extraction_model}
      factExtractionPromptVersion={fileNote.fact_extraction_prompt_version}
      factPublishDecisions={fileNote.fact_publish_decisions}
      parkOnlyCategories={PARK_ONLY_CATEGORIES}
      publishedTasks={fileNote.source_tasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        subtype: task.subtype,
        actorSide: task.actor_side,
        dueDate: task.dueDateStart?.toISOString() ?? null,
        mondaySyncState: task.monday_sync_state,
      }))}
      taskTypeOptions={taskTypeRows.map((row) => ({
        type: row.type,
        subtype: row.subtype,
      }))}
      attendeeSuggestions={attendees.map((attendee) => ({
        displayName: attendee.display_name,
        attendeeType: attendee.attendee_type,
      }))}
    />
  )
}
