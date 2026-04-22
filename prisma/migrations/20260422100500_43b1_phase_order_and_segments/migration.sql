-- Task 43b.1 - phase transitions and service segments

-- 1) phase_order should be nullable for non-chain templates.
ALTER TABLE "workflow_template"
  ALTER COLUMN "phase_order" DROP NOT NULL;

-- Keep only the manual-advance chain ordered; all other templates are not in-chain.
UPDATE "workflow_template"
SET
  "phase_order" = CASE
    WHEN "key" = 'initial_contact' THEN 1
    WHEN "key" = 'engagement' THEN 2
    WHEN "key" = 'advice' THEN 3
    WHEN "key" = 'implementation' THEN 4
    ELSE NULL
  END,
  "updated_at" = NOW();

-- 2) Add closing workflow template (idempotent).
INSERT INTO "workflow_template" (
  "id",
  "key",
  "name",
  "trigger_meeting_type_key",
  "phase_order",
  "version",
  "description",
  "stages",
  "status",
  "deployed_at",
  "created_at",
  "updated_at"
)
VALUES (
  'f1503549-9186-4fd1-a262-c2bcf79295f7',
  'closing',
  'Closing - client not proceeding',
  NULL,
  NULL,
  1,
  'Placeholder closing workflow spawned when a prospect/client is marked not proceeding. Task content drafted in Task 44.',
  '[]'::jsonb,
  'deployed',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT "workflow_template_key_key" DO NOTHING;

-- Ensure canonical closing values if a row already exists.
UPDATE "workflow_template"
SET
  "name" = 'Closing - client not proceeding',
  "trigger_meeting_type_key" = NULL,
  "phase_order" = NULL,
  "version" = 1,
  "description" = 'Placeholder closing workflow spawned when a prospect/client is marked not proceeding. Task content drafted in Task 44.',
  "status" = 'deployed',
  "updated_at" = NOW()
WHERE "key" = 'closing';

-- 3) Add three placeholder tasks for closing workflow.
WITH closing_template AS (
  SELECT "id"
  FROM "workflow_template"
  WHERE "key" = 'closing'
  LIMIT 1
)
INSERT INTO "workflow_task_template" (
  "id",
  "workflow_template_id",
  "title",
  "description",
  "category",
  "owner_role",
  "due_offset_days",
  "due_date_absolute",
  "sort_order",
  "created_at"
)
SELECT
  '6f747c7e-526f-460e-9fe7-c430a57bb0a0',
  ct."id",
  'Placeholder - Send thank-you / not-proceeding email',
  'Placeholder - to be replaced by real content in Task 44.',
  'Admin',
  'admin',
  0,
  NULL,
  1,
  NOW()
FROM closing_template ct
WHERE NOT EXISTS (
  SELECT 1
  FROM "workflow_task_template" wtt
  WHERE wtt."workflow_template_id" = ct."id"
    AND wtt."sort_order" = 1
    AND wtt."title" = 'Placeholder - Send thank-you / not-proceeding email'
)
ON CONFLICT ON CONSTRAINT "workflow_task_template_pkey" DO NOTHING;

WITH closing_template AS (
  SELECT "id"
  FROM "workflow_template"
  WHERE "key" = 'closing'
  LIMIT 1
)
INSERT INTO "workflow_task_template" (
  "id",
  "workflow_template_id",
  "title",
  "description",
  "category",
  "owner_role",
  "due_offset_days",
  "due_date_absolute",
  "sort_order",
  "created_at"
)
SELECT
  'c5b2f831-cb6c-4418-9f40-d5d7f8f7ab2b',
  ct."id",
  'Placeholder - Update client record / segmentation',
  'Placeholder - to be replaced by real content in Task 44.',
  'Admin',
  'admin',
  0,
  NULL,
  2,
  NOW()
FROM closing_template ct
WHERE NOT EXISTS (
  SELECT 1
  FROM "workflow_task_template" wtt
  WHERE wtt."workflow_template_id" = ct."id"
    AND wtt."sort_order" = 2
    AND wtt."title" = 'Placeholder - Update client record / segmentation'
)
ON CONFLICT ON CONSTRAINT "workflow_task_template_pkey" DO NOTHING;

WITH closing_template AS (
  SELECT "id"
  FROM "workflow_template"
  WHERE "key" = 'closing'
  LIMIT 1
)
INSERT INTO "workflow_task_template" (
  "id",
  "workflow_template_id",
  "title",
  "description",
  "category",
  "owner_role",
  "due_offset_days",
  "due_date_absolute",
  "sort_order",
  "created_at"
)
SELECT
  'ba7b1ec8-f677-40f4-a8d6-c180178f53b6',
  ct."id",
  'Placeholder - Add to Mailchimp prospect-nurture list',
  'Placeholder - to be replaced by real content in Task 44.',
  'Admin',
  'admin',
  1,
  NULL,
  3,
  NOW()
FROM closing_template ct
WHERE NOT EXISTS (
  SELECT 1
  FROM "workflow_task_template" wtt
  WHERE wtt."workflow_template_id" = ct."id"
    AND wtt."sort_order" = 3
    AND wtt."title" = 'Placeholder - Add to Mailchimp prospect-nurture list'
)
ON CONFLICT ON CONSTRAINT "workflow_task_template_pkey" DO NOTHING;

-- 4) Extend lifecycle stage vocabulary.
ALTER TABLE "client_classification"
  DROP CONSTRAINT IF EXISTS "client_classification_lifecycle_stage_check";

ALTER TABLE "client_classification"
  ADD CONSTRAINT "client_classification_lifecycle_stage_check"
  CHECK (
    "lifecycle_stage" IS NULL
    OR "lifecycle_stage" = ANY (
      ARRAY[
        'prospect'::text,
        'engagement'::text,
        'advice'::text,
        'implementation'::text,
        'client'::text,
        'lost'::text,
        'ceased'::text
      ]
    )
  );

-- 5) Add service_segment and enforce allowed values.
ALTER TABLE "client_classification"
  ADD COLUMN IF NOT EXISTS "service_segment" TEXT;

ALTER TABLE "client_classification"
  DROP CONSTRAINT IF EXISTS "client_classification_service_segment_check";

ALTER TABLE "client_classification"
  ADD CONSTRAINT "client_classification_service_segment_check"
  CHECK (
    "service_segment" IS NULL
    OR "service_segment" = ANY (
      ARRAY[
        'transaction'::text,
        'cashflow'::text,
        'wealth'::text,
        'wealth_plus'::text
      ]
    )
  );
