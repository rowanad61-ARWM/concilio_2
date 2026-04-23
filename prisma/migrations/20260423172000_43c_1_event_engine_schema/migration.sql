-- Task 43c.1 - event-driven workflow engine schema foundation
-- NOTE: Uses live table names verified via introspection:
--   user_account, "EmailTemplate", workflow_task_template, workflow_template

-- 1) workflow_instance - scheduled state support
ALTER TABLE workflow_instance
  ADD COLUMN IF NOT EXISTS scheduled_start_date TIMESTAMPTZ NULL;

ALTER TABLE workflow_instance
  DROP CONSTRAINT IF EXISTS workflow_instance_status_check;

ALTER TABLE workflow_instance
  ADD CONSTRAINT workflow_instance_status_check
  CHECK (
    status IN ('active', 'paused', 'completed', 'cancelled', 'error', 'scheduled')
  );

CREATE INDEX IF NOT EXISTS idx_wfi_status_scheduled_start
  ON workflow_instance (status, scheduled_start_date);

-- 2) workflow_task_template_outcome - outcome catalog
CREATE TABLE IF NOT EXISTS workflow_task_template_outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_task_template_id UUID NOT NULL
    REFERENCES workflow_task_template(id) ON DELETE CASCADE,
  outcome_key TEXT NOT NULL,
  outcome_label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_terminal_lost BOOLEAN NOT NULL DEFAULT FALSE,
  next_phase_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_task_template_outcome_unique
    UNIQUE (workflow_task_template_id, outcome_key)
);

CREATE INDEX IF NOT EXISTS idx_wtto_template_sort
  ON workflow_task_template_outcome (workflow_task_template_id, sort_order);

-- 3) workflow_spawned_task - outcome recording
ALTER TABLE workflow_spawned_task
  ADD COLUMN IF NOT EXISTS outcome_key TEXT NULL;

ALTER TABLE workflow_spawned_task
  ADD COLUMN IF NOT EXISTS outcome_set_at TIMESTAMPTZ NULL;

ALTER TABLE workflow_spawned_task
  ADD COLUMN IF NOT EXISTS outcome_set_by UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_spawned_task_outcome_set_by_fkey'
      AND conrelid = 'workflow_spawned_task'::regclass
  ) THEN
    ALTER TABLE workflow_spawned_task
      ADD CONSTRAINT workflow_spawned_task_outcome_set_by_fkey
      FOREIGN KEY (outcome_set_by)
      REFERENCES user_account(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 4) nudge_template - nudge definition catalog
CREATE TABLE IF NOT EXISTS nudge_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  trigger_workflow_template_key TEXT NULL,
  trigger_task_template_id UUID NULL
    REFERENCES workflow_task_template(id) ON DELETE SET NULL,
  trigger_condition TEXT NOT NULL,
  cadence_days INT NOT NULL,
  max_count INT NOT NULL DEFAULT 3,
  email_template_id TEXT NULL
    REFERENCES "EmailTemplate"(id) ON DELETE SET NULL,
  escalation_action TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nudge_template_target_audience_check
    CHECK (target_audience IN ('client', 'adviser')),
  CONSTRAINT nudge_template_cadence_days_check
    CHECK (cadence_days > 0),
  CONSTRAINT nudge_template_max_count_check
    CHECK (max_count > 0),
  CONSTRAINT nudge_template_status_check
    CHECK (status IN ('draft', 'deployed', 'retired'))
);

-- 5) nudge_event - runtime nudge history
CREATE TABLE IF NOT EXISTS nudge_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nudge_template_id UUID NOT NULL
    REFERENCES nudge_template(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  sequence_number INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT NULL,
  outcome_at TIMESTAMPTZ NULL,
  CONSTRAINT nudge_event_subject_type_check
    CHECK (subject_type IN ('engagement', 'task', 'workflow_instance')),
  CONSTRAINT nudge_event_sequence_number_check
    CHECK (sequence_number >= 1)
);

CREATE INDEX IF NOT EXISTS idx_nudge_event_subject
  ON nudge_event (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_nudge_event_template_sent
  ON nudge_event (nudge_template_id, sent_at DESC);

-- 6) party - communication preference
ALTER TABLE party
  ADD COLUMN IF NOT EXISTS communication_preference TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE party
  DROP CONSTRAINT IF EXISTS party_communication_preference_check;

ALTER TABLE party
  ADD CONSTRAINT party_communication_preference_check
  CHECK (communication_preference IN ('auto', 'manual'));
