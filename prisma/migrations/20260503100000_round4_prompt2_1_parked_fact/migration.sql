-- Round 4 Prompt 2.1: parked facts for transcript fact-confirmation workflow

CREATE TABLE public.parked_fact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.party(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_extract JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file_note_id UUID REFERENCES public.file_note(id) ON DELETE SET NULL,
  parked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parked_by UUID NOT NULL REFERENCES public.user_account(id),
  status TEXT NOT NULL DEFAULT 'parked',
  migrated_to_table TEXT,
  migrated_to_id UUID,
  migrated_at TIMESTAMPTZ,
  migrated_by UUID REFERENCES public.user_account(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parked_fact_status_check CHECK (status IN ('parked', 'migrated', 'discarded'))
);

CREATE INDEX idx_parked_fact_party_status ON public.parked_fact(party_id, status);
CREATE INDEX idx_parked_fact_source_file_note ON public.parked_fact(source_file_note_id);
