ALTER TABLE "public"."household_member"
  ADD COLUMN "is_financial_dependant" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "dependant_until_age" INTEGER,
  ADD COLUMN "relation" TEXT,
  ADD COLUMN "relation_to_member_id" UUID,
  ADD COLUMN "dependant_notes" TEXT;

ALTER TABLE "public"."household_member"
  ADD CONSTRAINT "household_member_relation_check"
  CHECK (
    "relation" IS NULL
    OR "relation" IN (
      'child',
      'step_child',
      'foster_child',
      'parent',
      'sibling',
      'other'
    )
  );

ALTER TABLE "public"."household_member"
  ADD CONSTRAINT "household_member_relation_to_member_id_fkey"
  FOREIGN KEY ("relation_to_member_id")
  REFERENCES "public"."household_member"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
