ALTER TABLE public.file_note
  ADD COLUMN extracted_facts JSONB,
  ADD COLUMN fact_extraction_at TIMESTAMPTZ,
  ADD COLUMN fact_extraction_model TEXT,
  ADD COLUMN fact_extraction_prompt_version TEXT,
  ADD COLUMN fact_publish_decisions JSONB;
