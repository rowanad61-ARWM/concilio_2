-- Task 43c.3c - Journey card UI support
--
-- Seed a distinct Initial Contact outcome for suitable prospects who choose
-- not to proceed. This preserves analytics separation from "not suitable".

WITH template_ids AS (
  SELECT hold.id AS hold_template_id
  FROM workflow_template wt
  JOIN workflow_task_template hold
    ON hold.workflow_template_id = wt.id
   AND hold.title = 'Hold 15 Min Call'
  WHERE wt.key = 'initial_contact'
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
  template_ids.hold_template_id,
  'not_proceeding',
  'Not Proceeding - prospect declined to proceed',
  5,
  TRUE,
  NULL::text,
  NULL::uuid,
  NULL::text,
  NULL::int,
  NOW(),
  NOW()
FROM template_ids
ON CONFLICT ON CONSTRAINT workflow_task_template_outcome_unique DO UPDATE
SET outcome_label = EXCLUDED.outcome_label,
    sort_order = EXCLUDED.sort_order,
    is_terminal_lost = EXCLUDED.is_terminal_lost,
    next_phase_key = EXCLUDED.next_phase_key,
    spawn_next_task_template_id = EXCLUDED.spawn_next_task_template_id,
    sets_workflow_status = EXCLUDED.sets_workflow_status,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = NOW();
