-- Task 43c.3f Half A - Engagement foundation
--
-- Engagement already exists as a deployed template with a placeholder task.
-- Replace that task with the real outcome holder, seed outcomes, email copy,
-- and the first non-Initial-Contact nudge configuration.

UPDATE workflow_template
SET name = 'Engagement',
    phase_order = 3,
    trigger_meeting_type_key = NULL,
    description = 'Workflow phase for sending the engagement document and tracking signed engagement.',
    status = 'deployed',
    updated_at = NOW()
WHERE key = 'engagement';

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
  'Track Engagement Document',
  'Send the engagement document and record whether the client signs, pauses, or does not proceed.',
  'Advice',
  'adviser',
  0,
  1
FROM workflow_template wt
WHERE wt.key = 'engagement'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Track Engagement Document'
  );

WITH engagement_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'engagement'
),
placeholder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN engagement_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title = 'Placeholder task — replace via SQL or workflow editor'
),
holder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN engagement_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title = 'Track Engagement Document'
)
UPDATE workflow_spawned_task spawned
SET workflow_task_template_id = holder.id
FROM placeholder, holder
WHERE spawned.workflow_task_template_id = placeholder.id;

WITH engagement_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'engagement'
)
DELETE FROM workflow_task_template wtt
USING engagement_template wt
WHERE wtt.workflow_template_id = wt.id
  AND wtt.title = 'Placeholder task — replace via SQL or workflow editor';

WITH template_ids AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Track Engagement Document'
  WHERE wt.key = 'engagement'
),
seed_rows AS (
  SELECT
    template_ids.holder_template_id AS workflow_task_template_id,
    'manually_mark_signed'::text AS outcome_key,
    'Mark engagement signed'::text AS outcome_label,
    1::int AS sort_order,
    false AS is_terminal_lost,
    'advice'::text AS next_phase_key,
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
VALUES (
  'engagement_doc',
  'Engagement document',
  $$Engagement document attached$$,
  $$Hi {{client_first_name}},

Please find the engagement document attached.

Once you have reviewed and signed it, we can move into the advice preparation stage. If you have any questions before signing, reply here and I can help.

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
VALUES (
  'engagement',
  'driving_engagement_doc',
  'send_engagement_doc',
  1,
  3,
  'engagement_doc',
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
