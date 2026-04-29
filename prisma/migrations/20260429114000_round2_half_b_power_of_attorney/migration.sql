CREATE TABLE "public"."power_of_attorney" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "poa_type" TEXT NOT NULL,
  "location" TEXT,
  "entity_type" TEXT NOT NULL,
  "first_name" TEXT,
  "surname" TEXT,
  "preferred_name" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "power_of_attorney_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "power_of_attorney_poa_type_check"
    CHECK (
      "poa_type" IN (
        'enduring',
        'general',
        'medical',
        'financial',
        'other'
      )
    ),
  CONSTRAINT "power_of_attorney_entity_type_check"
    CHECK (
      "entity_type" IN (
        'person',
        'trustee_company',
        'other'
      )
    ),
  CONSTRAINT "power_of_attorney_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_power_of_attorney_person_id"
  ON "public"."power_of_attorney"("person_id");
