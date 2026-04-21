-- NOTE: previous failed attempt resolved by inserting a
-- status value that satisfies the existing check constraint.
ALTER TABLE "workflow_template"
  ADD COLUMN IF NOT EXISTS "key" TEXT,
  ADD COLUMN IF NOT EXISTS "trigger_meeting_type_key" TEXT,
  ADD COLUMN IF NOT EXISTS "phase_order" INTEGER,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6);

UPDATE "workflow_template"
SET "key" = LOWER(REGEXP_REPLACE(COALESCE(NULLIF("name", ''), 'workflow_template'), '[^a-zA-Z0-9]+', '_', 'g')) || '_' || SUBSTRING("id"::text, 1, 8)
WHERE "key" IS NULL OR BTRIM("key") = '';

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS seq
  FROM "workflow_template"
)
UPDATE "workflow_template" wt
SET "phase_order" = ordered.seq
FROM ordered
WHERE wt."id" = ordered."id"
  AND wt."phase_order" IS NULL;

UPDATE "workflow_template"
SET "updated_at" = COALESCE("created_at", NOW())
WHERE "updated_at" IS NULL;

ALTER TABLE "workflow_template"
  ALTER COLUMN "key" SET NOT NULL,
  ALTER COLUMN "phase_order" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_template_key_key'
  ) THEN
    ALTER TABLE "workflow_template"
      ADD CONSTRAINT "workflow_template_key_key" UNIQUE ("key");
  END IF;
END $$;

ALTER TABLE "workflow_instance"
  ADD COLUMN IF NOT EXISTS "workflow_template_id" UUID,
  ADD COLUMN IF NOT EXISTS "trigger_date" TIMESTAMPTZ(6);

UPDATE "workflow_instance"
SET "workflow_template_id" = "template_id"
WHERE "workflow_template_id" IS NULL;

UPDATE "workflow_instance"
SET "trigger_date" = COALESCE("started_at", "created_at", NOW())
WHERE "trigger_date" IS NULL;

DELETE FROM "workflow_event" we
USING "workflow_instance" wi
WHERE we."instance_id" = wi."id"
  AND (wi."engagement_id" IS NULL OR wi."workflow_template_id" IS NULL);

DELETE FROM "workflow_instance"
WHERE "engagement_id" IS NULL OR "workflow_template_id" IS NULL;

ALTER TABLE "workflow_instance"
  ALTER COLUMN "template_version" SET DEFAULT 1,
  ALTER COLUMN "current_stage" SET DEFAULT 'active',
  ALTER COLUMN "engagement_id" SET NOT NULL,
  ALTER COLUMN "workflow_template_id" SET NOT NULL,
  ALTER COLUMN "trigger_date" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_instance_workflow_template_id_fkey'
  ) THEN
    ALTER TABLE "workflow_instance"
      ADD CONSTRAINT "workflow_instance_workflow_template_id_fkey"
      FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_template"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_wfi_workflow_template_id" ON "workflow_instance"("workflow_template_id");

CREATE TABLE IF NOT EXISTS "workflow_task_template" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workflow_template_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "owner_role" TEXT NOT NULL,
  "due_offset_days" INTEGER,
  "due_date_absolute" DATE,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "workflow_task_template_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_task_template_workflow_template_id_fkey'
  ) THEN
    ALTER TABLE "workflow_task_template"
      ADD CONSTRAINT "workflow_task_template_workflow_template_id_fkey"
      FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_wtt_workflow_template_id" ON "workflow_task_template"("workflow_template_id");

CREATE TABLE IF NOT EXISTS "workflow_spawned_task" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workflow_instance_id" UUID NOT NULL,
  "workflow_task_template_id" UUID NOT NULL,
  "task_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "workflow_spawned_task_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_spawned_task_workflow_instance_id_fkey'
  ) THEN
    ALTER TABLE "workflow_spawned_task"
      ADD CONSTRAINT "workflow_spawned_task_workflow_instance_id_fkey"
      FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_spawned_task_workflow_task_template_id_fkey'
  ) THEN
    ALTER TABLE "workflow_spawned_task"
      ADD CONSTRAINT "workflow_spawned_task_workflow_task_template_id_fkey"
      FOREIGN KEY ("workflow_task_template_id") REFERENCES "workflow_task_template"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_spawned_task_task_id_fkey'
  ) THEN
    ALTER TABLE "workflow_spawned_task"
      ADD CONSTRAINT "workflow_spawned_task_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_spawned_task_task_id_key" ON "workflow_spawned_task"("task_id");
CREATE INDEX IF NOT EXISTS "idx_wst_workflow_instance_id" ON "workflow_spawned_task"("workflow_instance_id");
CREATE INDEX IF NOT EXISTS "idx_wst_workflow_task_template_id" ON "workflow_spawned_task"("workflow_task_template_id");

INSERT INTO "workflow_template" (
  "key",
  "name",
  "trigger_meeting_type_key",
  "phase_order",
  "version",
  "description",
  "stages",
  "status",
  "created_at",
  "updated_at"
)
VALUES
  ('initial_contact', 'Initial Contact', 'INITIAL_MEETING', 1, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW()),
  ('engagement', 'Engagement', NULL, 2, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW()),
  ('advice', 'Advice', NULL, 3, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW()),
  ('implementation', 'Implementation', NULL, 4, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW()),
  ('ninety_day_recap', 'Ninety Day Recap', 'NINETY_DAY_RECAP', 5, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW()),
  ('annual_review', 'Annual Review', 'ANNUAL_REVIEW', 6, 1, 'Workflow phase template', '[]'::jsonb, 'deployed', NOW(), NOW())
ON CONFLICT ("name", "version") DO NOTHING;

INSERT INTO "workflow_task_template" (
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
  wt."id",
  'Placeholder task — replace via SQL or workflow editor',
  NULL,
  NULL,
  'adviser',
  -1,
  NULL,
  0,
  NOW()
FROM "workflow_template" wt
WHERE wt."key" IN (
  'initial_contact',
  'engagement',
  'advice',
  'implementation',
  'ninety_day_recap',
  'annual_review'
)
AND NOT EXISTS (
  SELECT 1
  FROM "workflow_task_template" wtt
  WHERE wtt."workflow_template_id" = wt."id"
);
