-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."address" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "address_type" TEXT NOT NULL,
    "line_1" TEXT,
    "line_2" TEXT,
    "suburb" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "country" TEXT DEFAULT 'AU',
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."advice_scope_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "scope_code" TEXT NOT NULL,
    "inclusion_flag" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advice_scope_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "details" JSONB DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."authority_grant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grantor_party_id" UUID NOT NULL,
    "grantee_party_id" UUID NOT NULL,
    "authority_type" TEXT NOT NULL,
    "scope" TEXT,
    "document_id" UUID,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authority_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."beneficiary_nomination" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "beneficiary_party_id" UUID NOT NULL,
    "nomination_type" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "effective_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "expiry_date" DATE,
    "witness_details" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_classification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "household_id" UUID,
    "service_tier" TEXT,
    "review_month" INTEGER,
    "assigned_adviser_id" UUID,
    "referral_source" TEXT,
    "client_since" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycle_stage" TEXT,

    CONSTRAINT "client_classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_instruction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "instruction_type" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "effective_date" DATE DEFAULT CURRENT_DATE,
    "expires_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_instruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."complaint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lodged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgement_date" DATE,
    "outcome_requested" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."compliance_register" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "register_type" TEXT NOT NULL,
    "party_id" UUID,
    "user_id" UUID,
    "description" TEXT NOT NULL,
    "date_recorded" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" TEXT DEFAULT 'open',
    "resolution" TEXT,
    "resolved_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."consent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "evidence_doc_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contact_method" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "preferred_flag" BOOLEAN DEFAULT false,
    "do_not_use_flag" BOOLEAN DEFAULT false,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID,
    "household_id" UUID,
    "engagement_id" UUID,
    "document_type" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT DEFAULT 'draft',
    "sharepoint_url" TEXT,
    "latest_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "storage_uri" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "checksum" TEXT,
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employment_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "employment_status" TEXT NOT NULL,
    "employer_business_name" TEXT,
    "occupation_title" TEXT,
    "industry" TEXT,
    "start_date" DATE,
    "target_retirement_date" DATE,
    "target_retirement_age" INTEGER,
    "annual_salary" DECIMAL(12,2),
    "salary_sacrifice" DECIMAL(12,2),
    "notes" TEXT,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."engagement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID,
    "party_id" UUID,
    "engagement_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "primary_adviser_id" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."estate" (
    "id" UUID NOT NULL,
    "estate_name" TEXT NOT NULL,
    "deceased_party_id" UUID,
    "date_of_death" DATE,
    "administration_status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" TEXT NOT NULL,
    "fixed_flag" BOOLEAN DEFAULT false,
    "start_date" DATE DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."external_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "system_code" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "sync_state" TEXT DEFAULT 'synced',
    "last_synced_at" TIMESTAMPTZ(6),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_arrangement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "household_id" UUID,
    "fee_type" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "basis_points" DECIMAL(5,2),
    "collection_method" TEXT DEFAULT 'cma_deduction',
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "anniversary_date" DATE,
    "end_date" DATE,
    "consent_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_arrangement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fee_disclosure_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fee_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "document_id" UUID,
    "outcome" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_disclosure_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."file_note" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID,
    "household_id" UUID,
    "engagement_id" UUID,
    "note_type" TEXT DEFAULT 'general',
    "text" TEXT NOT NULL,
    "audio_ref" TEXT,
    "author_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."financial_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "account_type" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT,
    "member_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "opened_date" DATE,
    "closed_date" DATE,
    "current_balance" DECIMAL(15,2),
    "balance_as_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "party_id" UUID,
    "goal_type" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "priority" INTEGER DEFAULT 1,
    "target_amount" DECIMAL(15,2),
    "target_date" DATE,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."household_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_name" TEXT NOT NULL,
    "servicing_status" TEXT NOT NULL DEFAULT 'active',
    "primary_adviser_id" UUID,
    "finance_style" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "household_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."household_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "role_in_household" TEXT NOT NULL DEFAULT 'member',
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "visibility_flags" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."income_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "income_type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" TEXT NOT NULL,
    "tax_treatment" TEXT,
    "start_date" DATE DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insurance_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "life_insured_party_id" UUID,
    "policy_type" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policy_number" TEXT,
    "cover_amount" DECIMAL(15,2),
    "premium_amount" DECIMAL(10,2),
    "premium_frequency" TEXT,
    "ownership_structure" TEXT,
    "super_account_id" UUID,
    "anniversary_date" DATE,
    "commencement_date" DATE,
    "expiry_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "waiting_period" TEXT,
    "benefit_period" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."liability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "liability_type" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL,
    "balance_as_at" DATE,
    "interest_rate" DECIMAL(5,2),
    "rate_type" TEXT,
    "repayment_amount" DECIMAL(10,2),
    "repayment_frequency" TEXT,
    "purpose" TEXT,
    "limit_amount" DECIMAL(15,2),
    "maturity_date" DATE,
    "offset_balance" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organisation" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "legal_entity_name" TEXT NOT NULL,
    "trading_name" TEXT,
    "abn" TEXT,
    "acn" TEXT,
    "registration_numbers" JSONB,
    "entity_formed_date" DATE,
    "formation_jurisdiction" TEXT DEFAULT 'AU',
    "registered_office_address" JSONB,
    "principal_business_address" JSONB,
    "primary_contact_party_id" UUID,
    "tax_identifier_enc" BYTEA,
    "entity_status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ownership_interest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_party_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "interest_type" TEXT DEFAULT 'legal',
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."party" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permission_grant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "permission_code" TEXT NOT NULL,
    "scope_type" TEXT,
    "scope_id" UUID,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."person" (
    "id" UUID NOT NULL,
    "legal_given_name" TEXT NOT NULL,
    "legal_middle_names" TEXT,
    "legal_family_name" TEXT NOT NULL,
    "preferred_name" TEXT,
    "previous_names" TEXT,
    "date_of_birth" DATE NOT NULL,
    "gender_pronouns" TEXT,
    "mobile_phone" TEXT,
    "email_primary" TEXT,
    "email_alternate" TEXT,
    "address_residential" JSONB,
    "address_postal" JSONB,
    "preferred_contact_method" TEXT,
    "preferred_contact_time" TEXT,
    "communication_exclusions" TEXT,
    "citizenships" TEXT[],
    "country_of_residence" TEXT DEFAULT 'AU',
    "relationship_status" TEXT,
    "relationship_status_date" DATE,
    "portal_access_preference" TEXT,
    "accessibility_needs" TEXT,
    "tax_file_number_enc" BYTEA,
    "person_status_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portal_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "invitation_status" TEXT DEFAULT 'pending',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."practice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "licensee_id" TEXT,
    "timezone" TEXT DEFAULT 'Australia/Sydney',
    "country" TEXT DEFAULT 'AU',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."property_asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "address" JSONB NOT NULL,
    "usage_type" TEXT,
    "purchase_price" DECIMAL(15,2),
    "purchase_date" DATE,
    "cost_base" DECIMAL(15,2),
    "current_value" DECIMAL(15,2),
    "value_as_at" DATE,
    "rental_income" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relationship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_party_id" UUID NOT NULL,
    "to_party_id" UUID NOT NULL,
    "relationship_role" TEXT NOT NULL,
    "percentage" DECIMAL(5,2),
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "notes" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."review_cycle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "review_type" TEXT NOT NULL DEFAULT 'annual',
    "due_date" DATE NOT NULL,
    "completed_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."risk_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "provider" TEXT DEFAULT 'finametrica',
    "risk_result" TEXT NOT NULL,
    "score" INTEGER,
    "capacity_for_loss" TEXT,
    "alignment_status" TEXT,
    "override_flag" BOOLEAN DEFAULT false,
    "override_reason" TEXT,
    "completed_at" DATE NOT NULL,
    "valid_until" DATE,
    "raw_answers_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_package" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_name" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "annual_fee" DECIMAL(10,2),
    "included_deliverables" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tax_residency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "country" TEXT NOT NULL,
    "tin" TEXT,
    "fatca_flag" BOOLEAN DEFAULT false,
    "crs_status" TEXT,
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_residency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "auth_subject" TEXT,
    "role" TEXT NOT NULL DEFAULT 'adviser',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_check" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "party_id" UUID NOT NULL,
    "check_type" TEXT NOT NULL,
    "identity_document_type" TEXT,
    "document_reference" TEXT,
    "verification_method" TEXT,
    "result" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "expiry_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "instance_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT,
    "payload" JSONB DEFAULT '{}',
    "triggered_by" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_instance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "engagement_id" UUID,
    "household_id" UUID,
    "party_id" UUID,
    "current_stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "last_event_at" TIMESTAMPTZ(6),
    "context_data" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "stages" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deployed_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_address_party" ON "public"."address"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "public"."audit_event"("actor_id" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_occurred" ON "public"."audit_event"("occurred_at" ASC);

-- CreateIndex
CREATE INDEX "idx_audit_subject" ON "public"."audit_event"("subject_type" ASC, "subject_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_class_party" ON "public"."client_classification"("party_id" ASC) WHERE (household_id IS NULL);

-- CreateIndex
CREATE INDEX "idx_consent_party" ON "public"."consent"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_consent_type" ON "public"."consent"("consent_type" ASC);

-- CreateIndex
CREATE INDEX "idx_contact_party" ON "public"."contact_method"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_doc_engagement" ON "public"."document"("engagement_id" ASC);

-- CreateIndex
CREATE INDEX "idx_doc_household" ON "public"."document"("household_id" ASC);

-- CreateIndex
CREATE INDEX "idx_doc_owner" ON "public"."document"("owner_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_emp_party" ON "public"."employment_profile"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_engagement_household" ON "public"."engagement"("household_id" ASC);

-- CreateIndex
CREATE INDEX "idx_engagement_status" ON "public"."engagement"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_engagement_type" ON "public"."engagement"("engagement_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_ext_link" ON "public"."external_link"("entity_type" ASC, "entity_id" ASC, "system_code" ASC);

-- CreateIndex
CREATE INDEX "idx_ext_system" ON "public"."external_link"("system_code" ASC);

-- CreateIndex
CREATE INDEX "idx_fn_household" ON "public"."file_note"("household_id" ASC);

-- CreateIndex
CREATE INDEX "idx_fn_party" ON "public"."file_note"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_fin_acc_owner" ON "public"."financial_account"("owner_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_fin_acc_type" ON "public"."financial_account"("account_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_hm_active" ON "public"."household_member"("household_id" ASC, "party_id" ASC) WHERE (end_date IS NULL);

-- CreateIndex
CREATE INDEX "idx_ins_anniversary" ON "public"."insurance_policy"("anniversary_date" ASC);

-- CreateIndex
CREATE INDEX "idx_ins_owner" ON "public"."insurance_policy"("owner_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_liability_owner" ON "public"."liability"("owner_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_org_abn" ON "public"."organisation"("abn" ASC);

-- CreateIndex
CREATE INDEX "idx_org_name" ON "public"."organisation"("legal_entity_name" ASC);

-- CreateIndex
CREATE INDEX "idx_org_type" ON "public"."organisation"("entity_type" ASC);

-- CreateIndex
CREATE INDEX "idx_own_owner" ON "public"."ownership_interest"("owner_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_own_target" ON "public"."ownership_interest"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX "idx_party_display_name" ON "public"."party"("display_name" ASC);

-- CreateIndex
CREATE INDEX "idx_party_status" ON "public"."party"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_party_type" ON "public"."party"("party_type" ASC);

-- CreateIndex
CREATE INDEX "idx_person_dob" ON "public"."person"("date_of_birth" ASC);

-- CreateIndex
CREATE INDEX "idx_person_name" ON "public"."person"("legal_family_name" ASC, "legal_given_name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "practice_code_key" ON "public"."practice"("code" ASC);

-- CreateIndex
CREATE INDEX "idx_rel_from" ON "public"."relationship"("from_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_rel_role" ON "public"."relationship"("relationship_role" ASC);

-- CreateIndex
CREATE INDEX "idx_rel_to" ON "public"."relationship"("to_party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_review_due" ON "public"."review_cycle"("due_date" ASC) WHERE (status = ANY (ARRAY['scheduled'::text, 'overdue'::text]));

-- CreateIndex
CREATE INDEX "idx_risk_party" ON "public"."risk_profile"("party_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "public"."user_account"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_verification_party" ON "public"."verification_check"("party_id" ASC);

-- CreateIndex
CREATE INDEX "idx_we_instance" ON "public"."workflow_event"("instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_we_occurred" ON "public"."workflow_event"("occurred_at" ASC);

-- CreateIndex
CREATE INDEX "idx_wfi_engagement" ON "public"."workflow_instance"("engagement_id" ASC);

-- CreateIndex
CREATE INDEX "idx_wfi_stage" ON "public"."workflow_instance"("current_stage" ASC);

-- CreateIndex
CREATE INDEX "idx_wfi_status" ON "public"."workflow_instance"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "idx_wft_name_version" ON "public"."workflow_template"("name" ASC, "version" ASC);

-- AddForeignKey
ALTER TABLE "public"."address" ADD CONSTRAINT "address_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."advice_scope_item" ADD CONSTRAINT "advice_scope_item_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."authority_grant" ADD CONSTRAINT "authority_grant_grantee_party_id_fkey" FOREIGN KEY ("grantee_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."authority_grant" ADD CONSTRAINT "authority_grant_grantor_party_id_fkey" FOREIGN KEY ("grantor_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."beneficiary_nomination" ADD CONSTRAINT "beneficiary_nomination_beneficiary_party_id_fkey" FOREIGN KEY ("beneficiary_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_classification" ADD CONSTRAINT "client_classification_assigned_adviser_id_fkey" FOREIGN KEY ("assigned_adviser_id") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_classification" ADD CONSTRAINT "client_classification_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_classification" ADD CONSTRAINT "client_classification_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."client_instruction" ADD CONSTRAINT "client_instruction_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."complaint" ADD CONSTRAINT "complaint_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."compliance_register" ADD CONSTRAINT "compliance_register_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."compliance_register" ADD CONSTRAINT "compliance_register_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."consent" ADD CONSTRAINT "consent_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contact_method" ADD CONSTRAINT "contact_method_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document" ADD CONSTRAINT "document_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document" ADD CONSTRAINT "document_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document" ADD CONSTRAINT "document_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_version" ADD CONSTRAINT "document_version_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."document_version" ADD CONSTRAINT "document_version_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."employment_profile" ADD CONSTRAINT "employment_profile_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."engagement" ADD CONSTRAINT "engagement_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."engagement" ADD CONSTRAINT "engagement_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."engagement" ADD CONSTRAINT "engagement_primary_adviser_id_fkey" FOREIGN KEY ("primary_adviser_id") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estate" ADD CONSTRAINT "estate_deceased_party_id_fkey" FOREIGN KEY ("deceased_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estate" ADD CONSTRAINT "estate_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."party"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."expense_item" ADD CONSTRAINT "expense_item_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fee_arrangement" ADD CONSTRAINT "fee_arrangement_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fee_arrangement" ADD CONSTRAINT "fee_arrangement_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fee_arrangement" ADD CONSTRAINT "fee_arrangement_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."fee_disclosure_event" ADD CONSTRAINT "fee_disclosure_event_fee_id_fkey" FOREIGN KEY ("fee_id") REFERENCES "public"."fee_arrangement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."file_note" ADD CONSTRAINT "file_note_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."file_note" ADD CONSTRAINT "file_note_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."file_note" ADD CONSTRAINT "file_note_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."file_note" ADD CONSTRAINT "file_note_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."financial_account" ADD CONSTRAINT "financial_account_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."goal" ADD CONSTRAINT "goal_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."goal" ADD CONSTRAINT "goal_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."household_group" ADD CONSTRAINT "fk_hg_adviser" FOREIGN KEY ("primary_adviser_id") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."household_member" ADD CONSTRAINT "household_member_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."household_member" ADD CONSTRAINT "household_member_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."income_item" ADD CONSTRAINT "income_item_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."insurance_policy" ADD CONSTRAINT "insurance_policy_life_insured_party_id_fkey" FOREIGN KEY ("life_insured_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."insurance_policy" ADD CONSTRAINT "insurance_policy_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."insurance_policy" ADD CONSTRAINT "insurance_policy_super_account_id_fkey" FOREIGN KEY ("super_account_id") REFERENCES "public"."financial_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."liability" ADD CONSTRAINT "liability_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."organisation" ADD CONSTRAINT "organisation_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."party"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."organisation" ADD CONSTRAINT "organisation_primary_contact_party_id_fkey" FOREIGN KEY ("primary_contact_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ownership_interest" ADD CONSTRAINT "ownership_interest_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."person" ADD CONSTRAINT "person_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."party"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."portal_account" ADD CONSTRAINT "portal_account_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."relationship" ADD CONSTRAINT "relationship_from_party_id_fkey" FOREIGN KEY ("from_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."relationship" ADD CONSTRAINT "relationship_to_party_id_fkey" FOREIGN KEY ("to_party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."review_cycle" ADD CONSTRAINT "review_cycle_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."risk_profile" ADD CONSTRAINT "risk_profile_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tax_residency" ADD CONSTRAINT "tax_residency_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_account" ADD CONSTRAINT "user_account_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."practice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."verification_check" ADD CONSTRAINT "verification_check_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."verification_check" ADD CONSTRAINT "verification_check_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_event" ADD CONSTRAINT "workflow_event_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_instance" ADD CONSTRAINT "workflow_instance_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_instance" ADD CONSTRAINT "workflow_instance_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."household_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_instance" ADD CONSTRAINT "workflow_instance_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "public"."party"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_instance" ADD CONSTRAINT "workflow_instance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_template"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."workflow_template" ADD CONSTRAINT "workflow_template_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

