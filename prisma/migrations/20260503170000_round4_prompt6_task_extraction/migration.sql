-- Round 4 Prompt 6: AI task extraction storage and task publish fields

CREATE TYPE "TaskActorSide" AS ENUM ('us', 'client');

ALTER TABLE public.file_note
  ADD COLUMN extracted_tasks JSONB,
  ADD COLUMN task_extraction_at TIMESTAMPTZ,
  ADD COLUMN task_extraction_model TEXT,
  ADD COLUMN task_extraction_prompt_version TEXT,
  ADD COLUMN task_publish_decisions JSONB;

ALTER TABLE public."Task"
  ADD COLUMN actor_side "TaskActorSide" NOT NULL DEFAULT 'us',
  ADD COLUMN monday_sync_state TEXT;
