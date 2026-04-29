CREATE TABLE "public"."estate_executor" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "first_name" TEXT,
  "surname" TEXT,
  "preferred_name" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "estate_executor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estate_executor_entity_type_check"
    CHECK (
      "entity_type" IN (
        'person',
        'trustee_company',
        'other'
      )
    ),
  CONSTRAINT "estate_executor_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_estate_executor_person_id"
  ON "public"."estate_executor"("person_id");
