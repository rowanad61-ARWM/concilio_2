CREATE TABLE "public"."super_pension_account" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "person_id" UUID NOT NULL,
  "account_type" TEXT NOT NULL,
  "provider_name" TEXT NOT NULL,
  "product_name" TEXT,
  "member_number" TEXT,
  "current_balance" NUMERIC(15,2),
  "balance_as_at" DATE,
  "investment_option" TEXT,
  "insurance_in_fund_summary" TEXT,
  "beneficiary_nomination_type" TEXT,
  "beneficiary_nomination_notes" TEXT,
  "contributions_ytd" NUMERIC(15,2),
  "bpay_biller_code" TEXT,
  "bpay_reference" TEXT,
  "notes" TEXT,
  "source_document_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "super_pension_account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "super_pension_account_account_type_check"
    CHECK (
      "account_type" IN (
        'super',
        'pension',
        'ttr',
        'defined_benefit',
        'smsf'
      )
    ),
  CONSTRAINT "super_pension_account_beneficiary_nomination_type_check"
    CHECK (
      "beneficiary_nomination_type" IS NULL
      OR "beneficiary_nomination_type" IN (
        'binding',
        'non_binding',
        'reversionary',
        'none',
        'unknown'
      )
    ),
  CONSTRAINT "super_pension_account_person_id_fkey"
    FOREIGN KEY ("person_id")
    REFERENCES "public"."person"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_super_pension_account_person_id"
  ON "public"."super_pension_account"("person_id");
