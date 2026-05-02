-- Round 4 Prompt 2A: file_note transcript support and task source linkage

CREATE TABLE public.meeting_transcript (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_text TEXT NOT NULL,
  speaker_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  speaker_name_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  recording_url TEXT NOT NULL,
  transcription_model TEXT NOT NULL,
  transcription_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calendly_event_uuid TEXT,
  engagement_id UUID REFERENCES public.engagement(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_transcript_engagement ON public.meeting_transcript(engagement_id);

ALTER TABLE public.file_note RENAME COLUMN audio_ref TO recording_url;

ALTER TABLE public.file_note
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN transcript_id UUID,
  ADD COLUMN generation_model TEXT,
  ADD COLUMN generation_prompt_version TEXT,
  ADD COLUMN generation_at TIMESTAMPTZ,
  ADD COLUMN review_state TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN ai_draft_content TEXT,
  ADD CONSTRAINT file_note_source_type_check CHECK (source_type IN ('manual', 'transcript')),
  ADD CONSTRAINT file_note_review_state_check CHECK (review_state IN ('draft', 'published')),
  ADD CONSTRAINT file_note_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.meeting_transcript(id) ON DELETE SET NULL;

UPDATE public.file_note
SET source_type = 'manual',
    review_state = 'published'
WHERE source_type IS DISTINCT FROM 'manual'
   OR review_state IS DISTINCT FROM 'published';

ALTER TABLE public."Task"
  ADD COLUMN "source_file_note_id" UUID,
  ADD CONSTRAINT "Task_source_file_note_id_fkey" FOREIGN KEY ("source_file_note_id") REFERENCES public.file_note(id) ON DELETE SET NULL;

CREATE INDEX "idx_task_source_file_note" ON public."Task"("source_file_note_id");
