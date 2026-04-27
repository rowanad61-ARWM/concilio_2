-- Task 43c.3e Half A - Discovery Meeting backend seed data
--
-- Prompt-1 amendments:
-- - Driver actions are code-defined, not table-seeded.
-- - Calendly event type routing is table-driven via calendly_event_type_map.

INSERT INTO workflow_template (
  id,
  key,
  name,
  phase_order,
  trigger_meeting_type_key,
  version,
  description,
  stages,
  status,
  deployed_at,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'discovery',
  'Discovery Meeting',
  NULL,
  'DISCOVERY',
  1,
  'Off-chain workflow for Discovery Meetings after Initial Meeting where additional fact finding is required.',
  '[]'::jsonb,
  'deployed',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    phase_order = EXCLUDED.phase_order,
    trigger_meeting_type_key = EXCLUDED.trigger_meeting_type_key,
    version = EXCLUDED.version,
    description = EXCLUDED.description,
    stages = EXCLUDED.stages,
    status = EXCLUDED.status,
    deployed_at = COALESCE(workflow_template.deployed_at, EXCLUDED.deployed_at),
    updated_at = NOW();

-- The existing Calendly "Initial Meeting Follow-up / Discovery" event is the
-- Discovery booking event. Reclassify it from GENERAL_MEETING to DISCOVERY.
INSERT INTO calendly_event_type_map (
  id,
  meeting_type_key,
  display_name,
  calendly_event_type_uri,
  auto_create_prospect,
  unresolved_log_level,
  active,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid()::text,
  'DISCOVERY',
  'Discovery Meeting (Andrew)',
  'https://api.calendly.com/event_types/HEPFN6NE2AOD46OO',
  false,
  'info',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (calendly_event_type_uri) DO UPDATE
SET meeting_type_key = EXCLUDED.meeting_type_key,
    display_name = EXCLUDED.display_name,
    auto_create_prospect = EXCLUDED.auto_create_prospect,
    unresolved_log_level = EXCLUDED.unresolved_log_level,
    active = EXCLUDED.active,
    updated_at = NOW();

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
  'Hold Discovery Meeting',
  'Hold the Discovery Meeting with the prospect. Record the outcome when complete.',
  'Advice',
  'adviser',
  0,
  1
FROM workflow_template wt
WHERE wt.key = 'discovery'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_task_template existing
    WHERE existing.workflow_template_id = wt.id
      AND existing.title = 'Hold Discovery Meeting'
  );

WITH template_ids AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Discovery Meeting'
  WHERE wt.key = 'discovery'
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

WITH im_holder AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Initial Meeting'
  WHERE wt.key = 'initial_meeting'
)
DELETE FROM workflow_task_template_outcome duplicate
USING im_holder
WHERE duplicate.workflow_task_template_id = im_holder.holder_template_id
  AND duplicate.outcome_key = 'proceeding'
  AND EXISTS (
    SELECT 1
    FROM workflow_task_template_outcome existing
    WHERE existing.workflow_task_template_id = im_holder.holder_template_id
      AND existing.outcome_key = 'proceeding_to_engagement'
  );

WITH im_holder AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Initial Meeting'
  WHERE wt.key = 'initial_meeting'
)
UPDATE workflow_task_template_outcome wtto
SET outcome_key = 'proceeding_to_engagement',
    outcome_label = 'Engagement',
    sort_order = 1,
    is_terminal_lost = false,
    next_phase_key = 'engagement',
    spawn_next_task_template_id = NULL,
    sets_workflow_status = NULL,
    max_attempts = NULL,
    updated_at = NOW()
FROM im_holder
WHERE wtto.workflow_task_template_id = im_holder.holder_template_id
  AND wtto.outcome_key IN ('proceeding', 'proceeding_to_engagement');

WITH im_holder AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Initial Meeting'
  WHERE wt.key = 'initial_meeting'
),
seed_row AS (
  SELECT
    im_holder.holder_template_id AS workflow_task_template_id,
    'proceeding_to_discovery'::text AS outcome_key,
    'Discovery Meeting'::text AS outcome_label,
    2::int AS sort_order,
    false AS is_terminal_lost,
    NULL::text AS next_phase_key,
    NULL::uuid AS spawn_next_task_template_id,
    NULL::text AS sets_workflow_status,
    NULL::int AS max_attempts
  FROM im_holder
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
  seed_row.workflow_task_template_id,
  seed_row.outcome_key,
  seed_row.outcome_label,
  seed_row.sort_order,
  seed_row.is_terminal_lost,
  seed_row.next_phase_key,
  seed_row.spawn_next_task_template_id,
  seed_row.sets_workflow_status,
  seed_row.max_attempts,
  NOW(),
  NOW()
FROM seed_row
ON CONFLICT ON CONSTRAINT workflow_task_template_outcome_unique DO UPDATE
SET outcome_label = EXCLUDED.outcome_label,
    sort_order = EXCLUDED.sort_order,
    is_terminal_lost = EXCLUDED.is_terminal_lost,
    next_phase_key = EXCLUDED.next_phase_key,
    spawn_next_task_template_id = EXCLUDED.spawn_next_task_template_id,
    sets_workflow_status = EXCLUDED.sets_workflow_status,
    max_attempts = EXCLUDED.max_attempts,
    updated_at = NOW();

WITH im_holder AS (
  SELECT holder.id AS holder_template_id
  FROM workflow_template wt
  JOIN workflow_task_template holder
    ON holder.workflow_template_id = wt.id
   AND holder.title = 'Hold Initial Meeting'
  WHERE wt.key = 'initial_meeting'
)
UPDATE workflow_task_template_outcome wtto
SET sort_order = CASE wtto.outcome_key
    WHEN 'not_proceeding' THEN 3
    WHEN 'on_hold' THEN 4
    ELSE wtto.sort_order
  END,
  outcome_label = CASE wtto.outcome_key
    WHEN 'not_proceeding' THEN 'Not Proceeding'
    WHEN 'on_hold' THEN 'On Hold'
    ELSE wtto.outcome_label
  END,
  updated_at = NOW()
FROM im_holder
WHERE wtto.workflow_task_template_id = im_holder.holder_template_id
  AND wtto.outcome_key IN ('not_proceeding', 'on_hold');

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
  'discovery_booking_link',
  'Discovery Meeting - booking link',
  $$Booking your Discovery Meeting with ARWM$$,
  $$Hi {{client_first_name}},

Thanks for meeting with me. Before we decide the best engagement path, I would like to spend a little more time understanding your situation and the advice areas that matter most.

Please use the link below to book your Discovery Meeting:

{{calendly_discovery_url}}

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Calendly',
  'email',
  TRUE,
  NOW(),
  NOW()
),
(
  'discovery_booking_confirmation',
  'Discovery Meeting confirmation',
  $$Your Discovery Meeting with {{adviser_name}} - {{meeting_date}}$$,
  $$Hi {{client_first_name}},

Thanks for booking your Discovery Meeting.

When: {{meeting_datetime}}
Duration: {{meeting_duration}}
Location: {{meeting_location}}

This meeting gives us time to fill in the gaps from the Initial Meeting and make sure any advice work is scoped properly before we move to Engagement.

If you need to make a change, you can reschedule here:
{{calendly_reschedule_url}}

Kind regards,
{{adviser_name}}
Andrew Rowan Wealth Management$$,
  'Calendly',
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
