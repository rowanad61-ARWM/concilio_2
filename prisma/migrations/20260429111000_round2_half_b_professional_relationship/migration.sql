CREATE TABLE "public"."professional_relationship" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "relationship_type" TEXT NOT NULL,
  "is_authorised" BOOLEAN NOT NULL DEFAULT FALSE,
  "authorisation_expiry" DATE,
  "first_name" TEXT,
  "surname" TEXT,
  "company" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address_line" TEXT,
  "address_suburb" TEXT,
  "address_state" TEXT,
  "address_postcode" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "professional_relationship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_relationship_relationship_type_check"
    CHECK (
      "relationship_type" IN (
        'doctor',
        'solicitor',
        'accountant',
        'banker',
        'mortgage_broker',
        'other_adviser',
        'other_professional'
      )
    ),
  CONSTRAINT "professional_relationship_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_professional_relationship_person_id"
  ON "public"."professional_relationship"("person_id");
