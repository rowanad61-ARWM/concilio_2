-- Round 4 Prompt 2C: meeting attendees and engagement modality

CREATE TABLE public.meeting_attendee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.engagement(id) ON DELETE CASCADE,
  attendee_type TEXT NOT NULL DEFAULT 'other',
  party_id UUID REFERENCES public.party(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meeting_attendee_attendee_type_check CHECK (attendee_type IN ('adviser', 'client', 'prospect', 'other'))
);

CREATE INDEX idx_meeting_attendee_engagement ON public.meeting_attendee(engagement_id);

ALTER TABLE public.engagement
  ADD COLUMN meeting_modality TEXT,
  ADD CONSTRAINT engagement_meeting_modality_check CHECK (meeting_modality IS NULL OR meeting_modality IN ('in_person', 'phone', 'teams', 'other'));
