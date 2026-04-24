-- Task 43c.3a - outcome-driven advance (initial_contact)
--
-- New outcome driver semantics:
-- - spawn_next_task_template_id: spawn another task from this template in the same workflow instance.
-- - sets_workflow_status: update workflow_instance.status when outcome is set (currently only "paused").
-- - max_attempts: cap number of spawned tasks for spawn_next_task_template_id per workflow instance.
--   If cap reached, no spawn should occur and the current task should move to NEEDS_REVIEW.

ALTER TABLE workflow_task_template_outcome
  ADD COLUMN IF NOT EXISTS spawn_next_task_template_id UUID NULL,
  ADD COLUMN IF NOT EXISTS sets_workflow_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS max_attempts INT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_wftto_spawn_next'
      AND conrelid = 'workflow_task_template_outcome'::regclass
  ) THEN
    ALTER TABLE workflow_task_template_outcome
      ADD CONSTRAINT fk_wftto_spawn_next
      FOREIGN KEY (spawn_next_task_template_id)
      REFERENCES workflow_task_template(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_wftto_sets_workflow_status'
      AND conrelid = 'workflow_task_template_outcome'::regclass
  ) THEN
    ALTER TABLE workflow_task_template_outcome
      ADD CONSTRAINT chk_wftto_sets_workflow_status
      CHECK (sets_workflow_status IS NULL OR sets_workflow_status IN ('paused'));
  END IF;
END
$$;

DO $$
DECLARE
  initial_contact_template_count INT;
  hold_template_id UUID;
BEGIN
  SELECT COUNT(*)
  INTO initial_contact_template_count
  FROM workflow_task_template
  WHERE workflow_template_id = (SELECT id FROM workflow_template WHERE key = 'initial_contact');

  IF initial_contact_template_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 workflow_task_template for initial_contact, found %.',
      initial_contact_template_count;
  END IF;

  SELECT id
  INTO hold_template_id
  FROM workflow_task_template
  WHERE workflow_template_id = (SELECT id FROM workflow_template WHERE key = 'initial_contact');

  UPDATE workflow_task_template
  SET title = 'Hold 15 Min Call',
      description = 'Hold the 15-minute call with the prospect. Record the outcome when complete.',
      category = 'Advice',
      owner_role = 'adviser',
      due_offset_days = 0,
      sort_order = 1
  WHERE id = hold_template_id;
END
$$;

INSERT INTO workflow_task_template (
  workflow_template_id,
  title,
  description,
  category,
  owner_role,
  due_offset_days,
  sort_order
)
SELECT
  wt.id,
  'Drive Initial Meeting booking',
  'Drive the prospect to book an Initial Meeting via Calendly. Use the action buttons on the task to either send a booking link to the client, or book on their behalf in Calendly yourself.',
  'Admin',
  'adviser',
  0,
  2
FROM workflow_template wt
WHERE wt.key = 'initial_contact'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Drive Initial Meeting booking'
  );

WITH template_ids AS (
  SELECT
    hold.id AS hold_template_id,
    drive.id AS drive_template_id
  FROM workflow_template wt
  JOIN workflow_task_template hold
    ON hold.workflow_template_id = wt.id
   AND hold.title = 'Hold 15 Min Call'
  JOIN workflow_task_template drive
    ON drive.workflow_template_id = wt.id
   AND drive.title = 'Drive Initial Meeting booking'
  WHERE wt.key = 'initial_contact'
),
seed_rows AS (
  SELECT
    template_ids.hold_template_id AS workflow_task_template_id,
    'suitable'::text AS outcome_key,
    'Suitable - proceed to book Initial Meeting'::text AS outcome_label,
    1::int AS sort_order,
    false AS is_terminal_lost,
    NULL::text AS next_phase_key,
    template_ids.drive_template_id AS spawn_next_task_template_id,
    NULL::text AS sets_workflow_status,
    1::int AS max_attempts
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.hold_template_id,
    'not_suitable',
    'Not Suitable - close off',
    2,
    true,
    NULL::text,
    NULL::uuid,
    NULL::text,
    NULL::int
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.hold_template_id,
    'no_answer',
    'No Answer - retry',
    3,
    false,
    NULL::text,
    template_ids.hold_template_id,
    NULL::text,
    3
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.hold_template_id,
    'on_hold',
    'On Hold - pause workflow',
    4,
    false,
    NULL::text,
    NULL::uuid,
    'paused',
    NULL::int
  FROM template_ids
)
INSERT INTO workflow_task_template_outcome (
  workflow_task_template_id,
  outcome_key,
  outcome_label,
  sort_order,
  is_terminal_lost,
  next_phase_key,
  spawn_next_task_template_id,
  sets_workflow_status,
  max_attempts,
  created_at,
  updated_at
)
SELECT
  seed_rows.workflow_task_template_id,
  seed_rows.outcome_key,
  seed_rows.outcome_label,
  seed_rows.sort_order,
  seed_rows.is_terminal_lost,
  seed_rows.next_phase_key,
  seed_rows.spawn_next_task_template_id,
  seed_rows.sets_workflow_status,
  seed_rows.max_attempts,
  NOW(),
  NOW()
FROM seed_rows
ON CONFLICT ON CONSTRAINT workflow_task_template_outcome_unique DO NOTHING;

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "category",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'calendly_initial_meeting_booking_link',
  'Initial Meeting - booking link (post-15-min call)',
  $$Booking your Initial Meeting with ARWM$$,
  $$Hi {{client_first_name}},

Thanks for the call. As discussed, please use the link below to book your Initial Meeting.

{{calendly_initial_meeting_url}}

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Calendly',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
