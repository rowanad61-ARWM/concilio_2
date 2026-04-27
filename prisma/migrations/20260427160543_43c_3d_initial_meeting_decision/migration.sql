-- Task 43c.3d - Initial Meeting decision card outcomes
--
-- Adds an Initial Meeting outcome holder and instance-level outcomes.
-- The holder is skipped from task spawning in workflow.ts by template key.

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
  'Hold Initial Meeting',
  'Hold the Initial Meeting with the prospect. Record the outcome when complete.',
  'Advice',
  'adviser',
  0,
  1
FROM workflow_template wt
WHERE wt.key = 'initial_meeting'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Hold Initial Meeting'
  );

WITH template_ids AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Initial Meeting'
  WHERE wt.key = 'initial_meeting'
),
seed_rows AS (
  SELECT
    template_ids.holder_template_id AS workflow_task_template_id,
    'proceeding'::text AS outcome_key,
    'Proceeding - move to Engagement'::text AS outcome_label,
    1::int AS sort_order,
    false AS is_terminal_lost,
    'engagement'::text AS next_phase_key,
    NULL::uuid AS spawn_next_task_template_id,
    NULL::text AS sets_workflow_status,
    NULL::int AS max_attempts
  FROM template_ids

  UNION ALL

  SELECT
    template_ids.holder_template_id,
    'not_proceeding',
    'Not Proceeding - prospect declined to engage',
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
    'On Hold - pause workflow',
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
