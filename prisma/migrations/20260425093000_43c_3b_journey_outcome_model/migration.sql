-- Task 43c.3b - journey-card instance outcome model
--
-- Initial Contact moves from task-outcome loops to an instance-level outcome
-- state. Existing task outcome catalog rows remain the source of available
-- outcome keys, but no Initial Contact task should be spawned by the new model.

ALTER TABLE workflow_instance
  ADD COLUMN IF NOT EXISTS no_answer_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_outcome_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS current_outcome_set_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_driver_action_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_driver_action_at TIMESTAMPTZ NULL;

ALTER TABLE "EmailTemplate"
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmailTemplate_channel_check'
      AND conrelid = '"EmailTemplate"'::regclass
  ) THEN
    ALTER TABLE "EmailTemplate"
      ADD CONSTRAINT "EmailTemplate_channel_check"
      CHECK (channel IN ('email', 'sms'));
  END IF;
END
$$;

WITH initial_contact_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'initial_contact'
),
initial_contact_task_templates AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN initial_contact_template ict ON ict.id = wtt.workflow_template_id
)
UPDATE workflow_task_template_outcome wtto
SET max_attempts = NULL,
    spawn_next_task_template_id = NULL,
    updated_at = NOW()
FROM initial_contact_task_templates wtt
WHERE wtto.workflow_task_template_id = wtt.id
  AND wtto.outcome_key = 'no_answer';

-- The instance-level booking driver replaces the legacy "Drive Initial
-- Meeting booking" spawned task for suitable Initial Contact outcomes.
WITH initial_contact_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'initial_contact'
),
initial_contact_task_templates AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN initial_contact_template ict ON ict.id = wtt.workflow_template_id
)
UPDATE workflow_task_template_outcome wtto
SET max_attempts = NULL,
    spawn_next_task_template_id = NULL,
    updated_at = NOW()
FROM initial_contact_task_templates wtt
WHERE wtto.workflow_task_template_id = wtt.id
  AND wtto.outcome_key = 'suitable';

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "category",
  "isActive",
  channel,
  "createdAt",
  "updatedAt"
)
VALUES (
  'no_answer_followup_email',
  'No answer follow-up email',
  $$Sorry we missed you$$,
  $$Hi {{client_first_name}},

We tried to reach you about your financial planning enquiry but could not get through.

Please reply to this email when you have a moment, or contact us to reschedule a suitable time.

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Workflow',
  TRUE,
  'email',
  NOW(),
  NOW()
),
(
  'no_answer_followup_sms',
  'No answer follow-up SMS',
  $$Hi {{client_first_name}}, tried calling about your financial planning enquiry. Please reply to reschedule. - {{adviser_name}}$$,
  $$Hi {{client_first_name}}, tried calling about your financial planning enquiry. Please reply to reschedule. - {{adviser_name}}$$,
  'Workflow',
  TRUE,
  'sms',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "subject" = EXCLUDED."subject",
    "body" = EXCLUDED."body",
    "category" = EXCLUDED."category",
    "isActive" = EXCLUDED."isActive",
    channel = EXCLUDED.channel,
    "updatedAt" = NOW();
