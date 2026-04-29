ALTER TABLE "public"."person"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "initials" TEXT,
  ADD COLUMN "maiden_name" TEXT,
  ADD COLUMN "mothers_maiden_name" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "place_of_birth" TEXT,
  ADD COLUMN "country_of_birth" TEXT,
  ADD COLUMN "resident_status" TEXT,
  ADD COLUMN "country_of_tax_residency" TEXT,
  ADD COLUMN "tax_resident_status" TEXT,
  ADD COLUMN "is_pep_risk" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "pep_notes" TEXT;

ALTER TABLE "public"."person"
  ADD CONSTRAINT "person_resident_status_check"
  CHECK (
    "resident_status" IS NULL
    OR "resident_status" IN (
      'australian_citizen',
      'permanent_resident',
      'temporary_resident',
      'other'
    )
  );

ALTER TABLE "public"."person"
  ADD CONSTRAINT "person_tax_resident_status_check"
  CHECK (
    "tax_resident_status" IS NULL
    OR "tax_resident_status" IN (
      'resident',
      'non_resident',
      'temporary_resident'
    )
  );
