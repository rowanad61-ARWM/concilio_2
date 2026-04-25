-- Task 43c.4 - Nudges engine
--
-- Adds workflow-specific nudge configuration and append-only audit rows for
-- Initial Contact booking nudges.

ALTER TABLE workflow_instance
  ADD COLUMN IF NOT EXISTS nudges_muted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS workflow_template_nudge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_key TEXT NOT NULL,
  decision_state_key TEXT NOT NULL,
  driver_action_key TEXT NOT NULL,
  nudge_sequence_index INT NOT NULL,
  delay_days INT NOT NULL,
  email_template_key TEXT NULL,
  sms_template_key TEXT NULL,
  preferred_channel TEXT NOT NULL,
  terminal BOOLEAN NOT NULL DEFAULT FALSE,
  terminal_outcome_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_template_nudge_unique
    UNIQUE (workflow_template_key, decision_state_key, driver_action_key, nudge_sequence_index),
  CONSTRAINT workflow_template_nudge_preferred_channel_check
    CHECK (preferred_channel IN ('email', 'sms')),
  CONSTRAINT workflow_template_nudge_delay_days_check
    CHECK (delay_days >= 0),
  CONSTRAINT workflow_template_nudge_sequence_check
    CHECK (nudge_sequence_index > 0)
);

CREATE INDEX IF NOT EXISTS idx_workflow_template_nudge_lookup
  ON workflow_template_nudge (workflow_template_key, decision_state_key, driver_action_key);

CREATE TABLE IF NOT EXISTS workflow_instance_nudge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instance(id) ON DELETE CASCADE,
  nudge_template_id UUID NOT NULL REFERENCES workflow_template_nudge(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_status TEXT NOT NULL,
  recipient TEXT NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL,
  error_detail TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_instance_nudge_unique
    UNIQUE (workflow_instance_id, nudge_template_id),
  CONSTRAINT workflow_instance_nudge_channel_check
    CHECK (channel IN ('email', 'sms')),
  CONSTRAINT workflow_instance_nudge_channel_status_check
    CHECK (channel_status IN ('sent', 'stubbed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_instance_nudge_instance_template
  ON workflow_instance_nudge (workflow_instance_id, nudge_template_id);

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
VALUES
(
  'ic_nudge_1_email',
  'Initial Contact booking nudge 1 email',
  $$Checking in on your meeting link$$,
  $$Hi {{client_first_name}},

Just checking you received the Initial Meeting booking link. If you have any questions before booking, reply here and I can help.

You can book here: {{calendly_initial_meeting_url}}

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
  'ic_nudge_1_sms',
  'Initial Contact booking nudge 1 SMS',
  $$Hi {{client_first_name}}, just checking you got the booking link for your Initial Meeting. Reply here with any questions. - {{adviser_name}}$$,
  $$Hi {{client_first_name}}, just checking you got the booking link for your Initial Meeting. Reply here with any questions. - {{adviser_name}}$$,
  'Workflow',
  TRUE,
  'sms',
  NOW(),
  NOW()
),
(
  'ic_nudge_2_email',
  'Initial Contact booking nudge 2 email',
  $$Initial Meeting booking reminder$$,
  $$Hi {{client_first_name}},

Just a reminder that the Initial Meeting booking link is still active.

If you would still like to talk through your financial planning enquiry, please choose a time here: {{calendly_initial_meeting_url}}

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
  'ic_nudge_2_sms',
  'Initial Contact booking nudge 2 SMS',
  $$Hi {{client_first_name}}, reminder that your Initial Meeting booking link is still active. Reply here or book when ready. - {{adviser_name}}$$,
  $$Hi {{client_first_name}}, reminder that your Initial Meeting booking link is still active. Reply here or book when ready. - {{adviser_name}}$$,
  'Workflow',
  TRUE,
  'sms',
  NOW(),
  NOW()
),
(
  'ic_closure_email',
  'Initial Contact closure nudge email',
  $$Closing this off for now$$,
  $$Hi {{client_first_name}},

We have not heard back, so we are closing this off for now.

If circumstances change, reply to this email and we will pick it back up.

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
  'ic_closure_sms',
  'Initial Contact closure nudge SMS',
  $$Hi {{client_first_name}}, we have not heard back, so we are closing this off for now. If things change, reply here and we will pick it back up.$$,
  $$Hi {{client_first_name}}, we have not heard back, so we are closing this off for now. If things change, reply here and we will pick it back up.$$,
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
  'initial_contact',
  'driving_booking',
  'send_booking_link',
  1,
  3,
  'ic_nudge_1_email',
  'ic_nudge_1_sms',
  'sms',
  FALSE,
  NULL,
  NOW(),
  NOW()
),
(
  'initial_contact',
  'driving_booking',
  'send_booking_link',
  2,
  7,
  'ic_nudge_2_email',
  'ic_nudge_2_sms',
  'sms',
  FALSE,
  NULL,
  NOW(),
  NOW()
),
(
  'initial_contact',
  'driving_booking',
  'send_booking_link',
  3,
  14,
  'ic_closure_email',
  'ic_closure_sms',
  'sms',
  TRUE,
  'not_proceeding',
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
