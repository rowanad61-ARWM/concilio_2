-- Task 43c.3f Half B - Advice phase
--
-- Advice already exists as a deployed chain template with a placeholder task.
-- Replace that task with the real outcome holder, seed outcomes, email copy,
-- reclaim the existing Calendly Advice event-type row, and seed Advice nudges.
-- meeting_type_key is TEXT in the schema/history, so no Postgres enum change is required.

UPDATE workflow_template
SET name = 'Advice',
    phase_order = 4,
    trigger_meeting_type_key = NULL,
    description = 'Workflow phase for booking the Advice Meeting, preparing and delivering advice, and tracking Authority to Proceed.',
    status = 'deployed',
    updated_at = NOW()
WHERE key = 'advice';

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
  'Track Advice Delivery',
  'Book the Advice Meeting, record SoA delivery, and record whether Authority to Proceed is signed.',
  'Advice',
  'adviser',
  0,
  1
FROM workflow_template wt
WHERE wt.key = 'advice'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Track Advice Delivery'
  );

WITH advice_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'advice'
),
placeholder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN advice_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title LIKE 'Placeholder task%'
),
holder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN advice_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title = 'Track Advice Delivery'
)
UPDATE workflow_spawned_task spawned
SET workflow_task_template_id = holder.id
FROM placeholder, holder
WHERE spawned.workflow_task_template_id = placeholder.id;

WITH advice_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'advice'
)
DELETE FROM workflow_task_template wtt
USING advice_template wt
WHERE wtt.workflow_template_id = wt.id
  AND wtt.title LIKE 'Placeholder task%';

WITH template_ids AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Track Advice Delivery'
  WHERE wt.key = 'advice'
),
seed_rows AS (
  SELECT
    template_ids.holder_template_id AS workflow_task_template_id,
    'proceeding_to_implementation'::text AS outcome_key,
    'Proceeding to Implementation'::text AS outcome_label,
    1::int AS sort_order,
    false AS is_terminal_lost,
    'implementation'::text AS next_phase_key,
    NULL::uuid AS spawn_next_task_template_id,
    NULL::text AS sets_workflow_status,
    NULL::int AS max_attempts
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.holder_template_id,
    'not_proceeding',
    'Not Proceeding',
    2,
    true,
    NULL::text,
    NULL::uuid,
    NULL::text,
    NULL::int
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.holder_template_id,
    'on_hold',
    'On Hold',
    3,
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
ON CONFLICT ON CONSTRAINT workflow_task_template_outcome_unique DO UPDATE
SET outcome_label = EXCLUDED.outcome_label,
    sort_order = EXCLUDED.sort_order,
    is_terminal_lost = EXCLUDED.is_terminal_lost,
    next_phase_key = EXCLUDED.next_phase_key,
    spawn_next_task_template_id = EXCLUDED.spawn_next_task_template_id,
    sets_workflow_status = EXCLUDED.sets_workflow_status,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = NOW();

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "category",
  "channel",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
(
  'advice_booking_link',
  'Advice booking link',
  $$Book your Advice Meeting$$,
  $$Hi {{client_first_name}},

You can book your Advice Meeting here:

{{calendly_advice_url}}

Once the meeting is booked, I will prepare the advice for delivery.

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Workflow',
  'email',
  TRUE,
  NOW(),
  NOW()
),
(
  'authority_to_proceed',
  'Authority to Proceed',
  $$Authority to Proceed$$,
  $$Hi {{client_first_name}},

Thank you for meeting to review your advice.

Please review and sign the Authority to Proceed so we can move into implementation. If you have any questions before signing, reply here and I can help.

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Workflow',
  'email',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "subject" = EXCLUDED."subject",
    "body" = EXCLUDED."body",
    "category" = EXCLUDED."category",
    "channel" = EXCLUDED."channel",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = NOW();

UPDATE calendly_event_type_map
SET meeting_type_key = 'ADVICE',
    display_name = 'Advice Meeting (Andrew)',
    auto_create_prospect = FALSE,
    unresolved_log_level = 'warn',
    active = TRUE,
    updated_at = NOW()
WHERE calendly_event_type_uri = 'https://api.calendly.com/event_types/FEPEQDJMUHFRF5SI';

INSERT INTO workflow_template_nudge (
  workflow_template_key,
  decision_state_key,
  driver_action_key,
  nudge_sequence_index,
  delay_days,
  email_template_key,
  sms_template_key,
  preferred_channel,
  terminal,
  terminal_outcome_key,
  created_at,
  updated_at
)
VALUES
(
  'advice',
  'driving_meeting_booking',
  'send_advice_booking_link',
  1,
  3,
  'advice_booking_link',
  NULL,
  'email',
  FALSE,
  NULL,
  NOW(),
  NOW()
),
(
  'advice',
  'driving_authority_signature',
  'record_soa_delivered',
  1,
  3,
  'authority_to_proceed',
  NULL,
  'email',
  FALSE,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT workflow_template_nudge_unique DO UPDATE
SET delay_days = EXCLUDED.delay_days,
    email_template_key = EXCLUDED.email_template_key,
    sms_template_key = EXCLUDED.sms_template_key,
    preferred_channel = EXCLUDED.preferred_channel,
    terminal = EXCLUDED.terminal,
    terminal_outcome_key = EXCLUDED.terminal_outcome_key,
    updated_at = NOW();
