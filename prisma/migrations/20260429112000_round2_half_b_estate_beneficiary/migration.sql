CREATE TABLE "public"."estate_beneficiary" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "first_name" TEXT,
  "surname" TEXT,
  "preferred_name" TEXT,
  "age_of_entitlement" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "estate_beneficiary_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estate_beneficiary_entity_type_check"
    CHECK (
      "entity_type" IN (
        'person',
        'charity',
        'trust',
        'estate',
        'other'
      )
    ),
  CONSTRAINT "estate_beneficiary_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_estate_beneficiary_person_id"
  ON "public"."estate_beneficiary"("person_id");
