-- Round 4 Prompt 5B: file_note publish audit fields

ALTER TABLE public.file_note
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID,
  ADD CONSTRAINT file_note_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.user_account(id) ON DELETE SET NULL;

CREATE INDEX idx_file_note_published_by ON public.file_note(published_by);
