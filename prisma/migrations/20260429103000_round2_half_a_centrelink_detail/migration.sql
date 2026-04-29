CREATE TABLE "public"."centrelink_detail" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "is_eligible" BOOLEAN,
  "benefit_type" TEXT,
  "crn" TEXT,
  "has_concession_card" BOOLEAN NOT NULL DEFAULT FALSE,
  "concession_card_type" TEXT,
  "has_gifted_assets" BOOLEAN NOT NULL DEFAULT FALSE,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "centrelink_detail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "centrelink_detail_benefit_type_check"
    CHECK (
      "benefit_type" IS NULL
      OR "benefit_type" IN (
        'age_pension',
        'disability_support',
        'family_payments',
        'carer_payment',
        'jobseeker',
        'other',
        'none'
      )
    ),
  CONSTRAINT "centrelink_detail_concession_card_type_check"
    CHECK (
      "concession_card_type" IS NULL
      OR "concession_card_type" IN (
        'pensioner_concession_card',
        'cshc',
        'hcc',
        'other'
      )
    ),
  CONSTRAINT "centrelink_detail_person_unique" UNIQUE ("person_id"),
  CONSTRAINT "centrelink_detail_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_centrelink_detail_person_id"
  ON "public"."centrelink_detail"("person_id");
