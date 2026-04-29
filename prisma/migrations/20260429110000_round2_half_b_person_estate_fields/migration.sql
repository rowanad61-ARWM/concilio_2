ALTER TABLE "public"."person"
  ADD COLUMN "will_exists" BOOLEAN,
  ADD COLUMN "will_is_current" BOOLEAN,
  ADD COLUMN "will_date" DATE,
  ADD COLUMN "will_location" TEXT,
  ADD COLUMN "estate_planning_notes" TEXT,
  ADD COLUMN "funeral_plan_status" TEXT;

ALTER TABLE "public"."person"
  ADD CONSTRAINT "person_funeral_plan_status_check"
  CHECK (
    "funeral_plan_status" IS NULL
    OR "funeral_plan_status" IN (
      'in_place',
      'pre_paid',
      'not_in_place',
      'unknown'
    )
  );
