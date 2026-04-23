-- Task 43c.2 - event-driven auto-advance to Initial Meeting

-- Renumber existing phase-order chain
UPDATE workflow_template
SET phase_order = 5
WHERE key = 'implementation' AND phase_order = 4;

UPDATE workflow_template
SET phase_order = 4
WHERE key = 'advice' AND phase_order = 3;

UPDATE workflow_template
SET phase_order = 3
WHERE key = 'engagement' AND phase_order = 2;

-- Insert the Initial Meeting parking phase
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
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'initial_meeting',
  'Initial Meeting',
  2,
  'INITIAL_MEETING',
  1,
  'Parking phase. Adviser-driven prep for the Initial Meeting. No default tasks.',
  '[]'::jsonb,
  'deployed',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Ensure INITIAL_MEETING can auto-create a prospect when invitee email is unresolved
UPDATE calendly_event_type_map
SET auto_create_prospect = true
WHERE meeting_type_key = 'INITIAL_MEETING' AND auto_create_prospect = false;
