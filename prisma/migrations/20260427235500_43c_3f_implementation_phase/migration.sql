-- Task 43c.3f Half C - Implementation phase
--
-- Implementation already exists as a deployed chain template with a placeholder task.
-- Replace that task with the real outcome holder and seed the final Implementation outcomes.

UPDATE workflow_template
SET name = 'Implementation',
    phase_order = 5,
    trigger_meeting_type_key = NULL,
    description = 'Workflow phase for completing advice implementation and recording the final service outcome.',
    status = 'deployed',
    updated_at = NOW()
WHERE key = 'implementation';

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
  'Track Implementation Outcome',
  'Record whether implementation completed with annual service, completed setup only, paused, or not proceeding.',
  'Implementation',
  'adviser',
  0,
  1
FROM workflow_template wt
WHERE wt.key = 'implementation'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Track Implementation Outcome'
  );

WITH implementation_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'implementation'
),
placeholder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN implementation_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title LIKE 'Placeholder task%'
),
holder AS (
  SELECT wtt.id
  FROM workflow_task_template wtt
  JOIN implementation_template wt ON wt.id = wtt.workflow_template_id
  WHERE wtt.title = 'Track Implementation Outcome'
)
UPDATE workflow_spawned_task spawned
SET workflow_task_template_id = holder.id
FROM placeholder, holder
WHERE spawned.workflow_task_template_id = placeholder.id;

WITH implementation_template AS (
  SELECT id
  FROM workflow_template
  WHERE key = 'implementation'
)
DELETE FROM workflow_task_template wtt
USING implementation_template wt
WHERE wtt.workflow_template_id = wt.id
  AND wtt.title LIKE 'Placeholder task%';

WITH template_ids AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Track Implementation Outcome'
  WHERE wt.key = 'implementation'
),
seed_rows AS (
  SELECT
    template_ids.holder_template_id AS workflow_task_template_id,
    'completed_with_annual_service'::text AS outcome_key,
    'Completed - Annual Service'::text AS outcome_label,
    1::int AS sort_order,
    false AS is_terminal_lost,
    NULL::text AS next_phase_key,
    NULL::uuid AS spawn_next_task_template_id,
    NULL::text AS sets_workflow_status,
    NULL::int AS max_attempts
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.holder_template_id,
    'completed_setup_only',
    'Completed - Setup Only',
    2,
    false,
    NULL::text,
    NULL::uuid,
    NULL::text,
    NULL::int
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.holder_template_id,
    'not_proceeding',
    'Not Proceeding',
    3,
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
ON CONFLICT ON CONSTRAINT workflow_task_template_outcome_unique DO UPDATE
SET outcome_label = EXCLUDED.outcome_label,
    sort_order = EXCLUDED.sort_order,
    is_terminal_lost = EXCLUDED.is_terminal_lost,
    next_phase_key = EXCLUDED.next_phase_key,
    spawn_next_task_template_id = EXCLUDED.spawn_next_task_template_id,
    sets_workflow_status = EXCLUDED.sets_workflow_status,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = NOW();
