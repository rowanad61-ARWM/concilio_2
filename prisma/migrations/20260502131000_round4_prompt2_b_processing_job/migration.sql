-- Round 4 Prompt 2B: generic processing job queue

CREATE TABLE public.processing_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT processing_job_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX idx_processing_job_status_scheduled ON public.processing_job(status, scheduled_at);
CREATE INDEX idx_processing_job_type_status ON public.processing_job(job_type, status);
