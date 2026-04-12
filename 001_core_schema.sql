-- ══════════════════════════════════════════════════════════════
-- CONCILIO — ARWM Practice Operating System
-- PostgreSQL Schema v0.1.0
-- Step 1: Core Graph + Security + Engagement
-- ══════════════════════════════════════════════════════════════
-- Architectural decisions:
--   • UUID primary keys everywhere
--   • Soft deletes (archived_at) — nothing is hard-deleted
--   • Audit trail via audit_events table
--   • Effective-dated records where history matters
--   • Australian financial planning domain-specific
--   • Single-tenant (ARWM only) — multi-tenant later if productized
-- ══════════════════════════════════════════════════════════════

-- Extensions
-- uuid-ossp not needed, using gen_random_uuid() built-in
-- pgcrypto not available on Azure, encryption handled at application layer

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 1: CORE PARTY GRAPH
-- The foundation — every person, entity, household, relationship
-- ══════════════════════════════════════════════════════════════

-- Party supertype: one row per real-world actor
CREATE TABLE party (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_type      TEXT NOT NULL CHECK (party_type IN ('person', 'organisation', 'estate')),
    display_name    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased', 'wound_up', 'dormant')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at     TIMESTAMPTZ
);

CREATE INDEX idx_party_type ON party(party_type);
CREATE INDEX idx_party_status ON party(status);
CREATE INDEX idx_party_display_name ON party(display_name);

-- Person subtype
CREATE TABLE person (
    id                          UUID PRIMARY KEY REFERENCES party(id) ON DELETE CASCADE,
    legal_given_name            TEXT NOT NULL,
    legal_middle_names          TEXT,
    legal_family_name           TEXT NOT NULL,
    preferred_name              TEXT,
    previous_names              TEXT,
    date_of_birth               DATE NOT NULL,
    gender_pronouns             TEXT,
    mobile_phone                TEXT,
    email_primary               TEXT,
    email_alternate             TEXT,
    address_residential         JSONB, -- {line1, line2, suburb, state, postcode, country}
    address_postal              JSONB,
    preferred_contact_method    TEXT CHECK (preferred_contact_method IN ('phone', 'email', 'portal', 'post', 'sms')),
    preferred_contact_time      TEXT,
    communication_exclusions    TEXT,
    citizenships                TEXT[], -- array of country codes
    country_of_residence        TEXT DEFAULT 'AU',
    relationship_status         TEXT CHECK (relationship_status IN ('single', 'married', 'de_facto', 'separated', 'divorced', 'widowed')),
    relationship_status_date    DATE,
    portal_access_preference    TEXT CHECK (portal_access_preference IN ('separate', 'shared')),
    accessibility_needs         TEXT,
    tax_file_number_enc         BYTEA, -- encrypted via pgcrypto
    person_status_notes         TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_person_name ON person(legal_family_name, legal_given_name);
CREATE INDEX idx_person_dob ON person(date_of_birth);

-- Organisation subtype (companies, trusts, SMSFs, partnerships, charities)
CREATE TABLE organisation (
    id                          UUID PRIMARY KEY REFERENCES party(id) ON DELETE CASCADE,
    entity_type                 TEXT NOT NULL CHECK (entity_type IN (
        'company', 'trust', 'smsf', 'partnership', 'estate', 'charity', 'other'
    )),
    legal_entity_name           TEXT NOT NULL,
    trading_name                TEXT,
    abn                         TEXT,
    acn                         TEXT,
    registration_numbers        JSONB, -- {smsf_abn, arbn, etc}
    entity_formed_date          DATE,
    formation_jurisdiction      TEXT DEFAULT 'AU',
    registered_office_address   JSONB,
    principal_business_address  JSONB,
    primary_contact_party_id    UUID REFERENCES party(id),
    tax_identifier_enc          BYTEA, -- encrypted
    entity_status               TEXT NOT NULL DEFAULT 'active' CHECK (entity_status IN ('active', 'dormant', 'wound_up', 'in_administration')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_type ON organisation(entity_type);
CREATE INDEX idx_org_name ON organisation(legal_entity_name);
CREATE INDEX idx_org_abn ON organisation(abn);

-- Estate (deceased estate administration)
CREATE TABLE estate (
    id                      UUID PRIMARY KEY REFERENCES party(id) ON DELETE CASCADE,
    estate_name             TEXT NOT NULL,
    deceased_party_id       UUID REFERENCES party(id),
    date_of_death           DATE,
    administration_status   TEXT CHECK (administration_status IN ('open', 'in_progress', 'finalised', 'closed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- HOUSEHOLD AND RELATIONSHIPS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE household_group (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_name      TEXT NOT NULL,
    servicing_status    TEXT NOT NULL DEFAULT 'active' CHECK (servicing_status IN ('active', 'inactive', 'prospect')),
    primary_adviser_id  UUID, -- FK to user_account added after that table
    finance_style       TEXT CHECK (finance_style IN ('shared', 'partially_shared', 'separate')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at         TIMESTAMPTZ
);

CREATE TABLE household_member (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id        UUID NOT NULL REFERENCES household_group(id),
    party_id            UUID NOT NULL REFERENCES party(id),
    role_in_household   TEXT NOT NULL DEFAULT 'member' CHECK (role_in_household IN (
        'primary', 'spouse', 'dependant', 'member', 'other'
    )),
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date            DATE,
    visibility_flags    JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_hm_active ON household_member(household_id, party_id) WHERE end_date IS NULL;

-- Generic relationship between any two parties
CREATE TABLE relationship (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_party_id       UUID NOT NULL REFERENCES party(id),
    to_party_id         UUID NOT NULL REFERENCES party(id),
    relationship_role   TEXT NOT NULL, -- 'spouse', 'child', 'parent', 'trustee', 'director', 'member', 'beneficiary', 'accountant', 'solicitor', etc.
    percentage          NUMERIC(5,2), -- ownership %, etc
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date            DATE,
    notes               TEXT,
    source              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rel_from ON relationship(from_party_id);
CREATE INDEX idx_rel_to ON relationship(to_party_id);
CREATE INDEX idx_rel_role ON relationship(relationship_role);

-- Authority grants (PoA, executor, guardian, signatory)
CREATE TABLE authority_grant (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grantor_party_id    UUID NOT NULL REFERENCES party(id),
    grantee_party_id    UUID NOT NULL REFERENCES party(id),
    authority_type      TEXT NOT NULL CHECK (authority_type IN (
        'power_of_attorney', 'executor', 'guardian', 'signatory', 'trustee', 'director', 'appointor', 'other'
    )),
    scope               TEXT,
    document_id         UUID, -- FK to document table
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date            DATE,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contact methods
CREATE TABLE contact_method (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES party(id),
    channel         TEXT NOT NULL CHECK (channel IN ('mobile', 'landline', 'email', 'fax', 'portal', 'post')),
    value           TEXT NOT NULL,
    preferred_flag  BOOLEAN DEFAULT false,
    do_not_use_flag BOOLEAN DEFAULT false,
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_party ON contact_method(party_id);

-- Addresses
CREATE TABLE address (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES party(id),
    address_type    TEXT NOT NULL CHECK (address_type IN ('residential', 'postal', 'registered_office', 'business')),
    line_1          TEXT,
    line_2          TEXT,
    suburb          TEXT,
    state           TEXT,
    postcode        TEXT,
    country         TEXT DEFAULT 'AU',
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_address_party ON address(party_id);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 2: SECURITY AND ACCESS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE practice (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    code            TEXT UNIQUE NOT NULL,
    licensee_id     TEXT,
    timezone        TEXT DEFAULT 'Australia/Sydney',
    country         TEXT DEFAULT 'AU',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_account (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id     UUID NOT NULL REFERENCES practice(id),
    name            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    auth_subject    TEXT, -- Azure AD subject
    role            TEXT NOT NULL DEFAULT 'adviser' CHECK (role IN ('owner', 'adviser', 'paraplanner', 'admin', 'readonly')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK we deferred
ALTER TABLE household_group
    ADD CONSTRAINT fk_hg_adviser FOREIGN KEY (primary_adviser_id) REFERENCES user_account(id);

CREATE TABLE portal_account (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id            UUID NOT NULL REFERENCES party(id),
    email               TEXT NOT NULL,
    invitation_status   TEXT DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'sent', 'accepted', 'disabled')),
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permission_grant (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_type    TEXT NOT NULL CHECK (subject_type IN ('user', 'portal')),
    subject_id      UUID NOT NULL,
    permission_code TEXT NOT NULL,
    scope_type      TEXT,
    scope_id        UUID,
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 3: KYC, AML AND PRIVACY
-- ══════════════════════════════════════════════════════════════

CREATE TABLE verification_check (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id                UUID NOT NULL REFERENCES party(id),
    check_type              TEXT NOT NULL CHECK (check_type IN (
        'identity_document', 'aml_screening', 'pep_check', 'sanctions_check', 'address_verification'
    )),
    identity_document_type  TEXT, -- 'passport', 'drivers_licence', etc
    document_reference      TEXT,
    verification_method     TEXT CHECK (verification_method IN ('manual', 'digital', 'certified_copy', 'provider')),
    result                  TEXT NOT NULL CHECK (result IN ('verified', 'pending', 'failed', 'expired')),
    verified_at             TIMESTAMPTZ,
    verified_by             UUID REFERENCES user_account(id),
    expiry_date             DATE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_party ON verification_check(party_id);

CREATE TABLE tax_residency (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES party(id),
    country         TEXT NOT NULL,
    tin             TEXT, -- tax identification number
    fatca_flag      BOOLEAN DEFAULT false,
    crs_status      TEXT,
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id            UUID NOT NULL REFERENCES party(id),
    consent_type        TEXT NOT NULL CHECK (consent_type IN (
        'privacy_notice', 'electronic_communication', 'portal_access',
        'third_party_data_sharing', 'marketing', 'ai_processing', 'fee_arrangement'
    )),
    status              TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'revoked', 'expired')),
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    evidence_doc_id     UUID, -- FK to document
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_party ON consent(party_id);
CREATE INDEX idx_consent_type ON consent(consent_type);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 4: ENGAGEMENT AND SERVICE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE engagement (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id            UUID REFERENCES household_group(id),
    party_id                UUID REFERENCES party(id), -- for entity-level engagements
    engagement_type         TEXT NOT NULL CHECK (engagement_type IN (
        'onboarding', 'annual_review', 'soa', 'roa', 'insurance',
        'aged_care', 'estate', 'limited_advice', 'one_off', 'other'
    )),
    status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'in_progress', 'awaiting_client', 'awaiting_signature',
        'implemented', 'completed', 'cancelled'
    )),
    primary_adviser_id      UUID REFERENCES user_account(id),
    opened_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_engagement_household ON engagement(household_id);
CREATE INDEX idx_engagement_status ON engagement(status);
CREATE INDEX idx_engagement_type ON engagement(engagement_type);

CREATE TABLE advice_scope_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES engagement(id),
    scope_code      TEXT NOT NULL, -- 'superannuation', 'insurance', 'investments', 'centrelink', 'estate_planning', 'debt', 'aged_care'
    inclusion_flag  BOOLEAN NOT NULL DEFAULT true, -- true = in scope, false = out of scope
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE goal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES engagement(id),
    party_id        UUID REFERENCES party(id),
    goal_type       TEXT NOT NULL, -- 'retirement_income', 'debt_reduction', 'wealth_accumulation', 'legacy', 'lifestyle', 'education', 'other'
    statement       TEXT NOT NULL,
    priority        INTEGER DEFAULT 1,
    target_amount   NUMERIC(15,2),
    target_date     DATE,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'deferred', 'cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE client_instruction (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES engagement(id),
    instruction_type TEXT NOT NULL CHECK (instruction_type IN (
        'preference', 'constraint', 'non_negotiable', 'decline_to_proceed', 'other'
    )),
    details         TEXT NOT NULL,
    effective_date  DATE DEFAULT CURRENT_DATE,
    expires_at      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client segmentation and service model
CREATE TABLE client_classification (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID NOT NULL REFERENCES party(id),
    household_id    UUID REFERENCES household_group(id),
    service_tier    TEXT CHECK (service_tier IN ('A', 'B', 'C', 'prospect', 'inactive')),
    review_month    INTEGER CHECK (review_month BETWEEN 1 AND 12),
    assigned_adviser_id UUID REFERENCES user_account(id),
    referral_source TEXT,
    client_since    DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_class_party ON client_classification(party_id) WHERE household_id IS NULL;

-- Service packages and review cycles
CREATE TABLE service_package (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_name            TEXT NOT NULL,
    cadence                 TEXT NOT NULL CHECK (cadence IN ('quarterly', 'semi_annual', 'annual', 'biennial')),
    annual_fee              NUMERIC(10,2),
    included_deliverables   JSONB DEFAULT '[]',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE review_cycle (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES engagement(id),
    review_type     TEXT NOT NULL DEFAULT 'annual',
    due_date        DATE NOT NULL,
    completed_date  DATE,
    status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_due ON review_cycle(due_date) WHERE status IN ('scheduled', 'overdue');

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 5: RISK AND FACT FIND
-- ══════════════════════════════════════════════════════════════

CREATE TABLE employment_profile (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id                UUID NOT NULL REFERENCES party(id),
    employment_status       TEXT NOT NULL CHECK (employment_status IN (
        'employed_full_time', 'employed_part_time', 'self_employed',
        'unemployed', 'retired', 'home_duties', 'student', 'other'
    )),
    employer_business_name  TEXT,
    occupation_title        TEXT,
    industry                TEXT,
    start_date              DATE,
    target_retirement_date  DATE,
    target_retirement_age   INTEGER,
    annual_salary           NUMERIC(12,2),
    salary_sacrifice        NUMERIC(12,2),
    notes                   TEXT,
    effective_from          DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to            DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_party ON employment_profile(party_id);

CREATE TABLE income_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id  UUID NOT NULL REFERENCES party(id),
    income_type     TEXT NOT NULL CHECK (income_type IN (
        'salary', 'pension_super', 'pension_government', 'rental',
        'dividends', 'interest', 'business', 'centrelink', 'other'
    )),
    description     TEXT,
    amount          NUMERIC(12,2) NOT NULL,
    frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
    tax_treatment   TEXT, -- 'taxable', 'tax_free', 'concessional'
    start_date      DATE DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id  UUID NOT NULL REFERENCES party(id),
    category        TEXT NOT NULL,
    description     TEXT,
    amount          NUMERIC(12,2) NOT NULL,
    frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
    fixed_flag      BOOLEAN DEFAULT false,
    start_date      DATE DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE risk_profile (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id            UUID NOT NULL REFERENCES party(id),
    provider            TEXT DEFAULT 'finametrica',
    risk_result         TEXT NOT NULL, -- 'conservative', 'moderately_conservative', 'balanced', 'growth', 'high_growth'
    score               INTEGER,
    capacity_for_loss   TEXT,
    alignment_status    TEXT CHECK (alignment_status IN ('aligned', 'misaligned', 'overridden')),
    override_flag       BOOLEAN DEFAULT false,
    override_reason     TEXT,
    completed_at        DATE NOT NULL,
    valid_until         DATE,
    raw_answers_json    JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_party ON risk_profile(party_id);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 6: FINANCIAL POSITION
-- ══════════════════════════════════════════════════════════════

CREATE TABLE financial_account (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id  UUID NOT NULL REFERENCES party(id),
    account_type    TEXT NOT NULL CHECK (account_type IN (
        'bank', 'term_deposit', 'wrap_platform', 'super_accumulation',
        'super_pension', 'direct_shares', 'managed_fund', 'insurance',
        'loan', 'credit_card', 'other'
    )),
    provider_name   TEXT NOT NULL,
    account_name    TEXT,
    account_number  TEXT,
    member_number   TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
    opened_date     DATE,
    closed_date     DATE,
    current_balance NUMERIC(15,2),
    balance_as_at   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_acc_owner ON financial_account(owner_party_id);
CREATE INDEX idx_fin_acc_type ON financial_account(account_type);

CREATE TABLE ownership_interest (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id  UUID NOT NULL REFERENCES party(id),
    target_type     TEXT NOT NULL, -- 'financial_account', 'property', 'business', 'organisation'
    target_id       UUID NOT NULL,
    interest_type   TEXT DEFAULT 'legal' CHECK (interest_type IN ('legal', 'beneficial', 'control')),
    percentage      NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_own_owner ON ownership_interest(owner_party_id);
CREATE INDEX idx_own_target ON ownership_interest(target_type, target_id);

CREATE TABLE property_asset (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address         JSONB NOT NULL,
    usage_type      TEXT CHECK (usage_type IN ('owner_occupied', 'investment', 'holiday', 'commercial', 'rural', 'other')),
    purchase_price  NUMERIC(15,2),
    purchase_date   DATE,
    cost_base       NUMERIC(15,2),
    current_value   NUMERIC(15,2),
    value_as_at     DATE,
    rental_income   NUMERIC(12,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE liability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id  UUID NOT NULL REFERENCES party(id),
    liability_type  TEXT NOT NULL CHECK (liability_type IN (
        'home_loan', 'investment_loan', 'personal_loan', 'car_loan',
        'credit_card', 'margin_loan', 'business_loan', 'other'
    )),
    lender          TEXT NOT NULL,
    balance         NUMERIC(15,2) NOT NULL,
    balance_as_at   DATE,
    interest_rate   NUMERIC(5,2),
    rate_type       TEXT CHECK (rate_type IN ('fixed', 'variable', 'split')),
    repayment_amount NUMERIC(10,2),
    repayment_frequency TEXT CHECK (repayment_frequency IN ('weekly', 'fortnightly', 'monthly')),
    purpose         TEXT,
    limit_amount    NUMERIC(15,2),
    maturity_date   DATE,
    offset_balance  NUMERIC(15,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liability_owner ON liability(owner_party_id);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 7: RETIREMENT AND INSURANCE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE beneficiary_nomination (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type             TEXT NOT NULL, -- 'super', 'pension', 'insurance', 'estate'
    source_id               UUID NOT NULL,
    beneficiary_party_id    UUID NOT NULL REFERENCES party(id),
    nomination_type         TEXT NOT NULL CHECK (nomination_type IN ('binding', 'non_binding', 'reversionary', 'lapsing')),
    percentage              NUMERIC(5,2) NOT NULL,
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date             DATE,
    witness_details         TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insurance_policy (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id          UUID NOT NULL REFERENCES party(id),
    life_insured_party_id   UUID REFERENCES party(id),
    policy_type             TEXT NOT NULL CHECK (policy_type IN (
        'life', 'tpd', 'income_protection', 'trauma', 'child_cover', 'bundled', 'other'
    )),
    insurer                 TEXT NOT NULL,
    policy_number           TEXT,
    cover_amount            NUMERIC(15,2),
    premium_amount          NUMERIC(10,2),
    premium_frequency       TEXT CHECK (premium_frequency IN ('monthly', 'quarterly', 'annually')),
    ownership_structure     TEXT, -- 'individual', 'super', 'cross_ownership'
    super_account_id        UUID REFERENCES financial_account(id),
    anniversary_date        DATE,
    commencement_date       DATE,
    expiry_date             DATE,
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lapsed', 'cancelled', 'claimed', 'replaced')),
    waiting_period          TEXT,
    benefit_period          TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ins_owner ON insurance_policy(owner_party_id);
CREATE INDEX idx_ins_anniversary ON insurance_policy(anniversary_date);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 8: FEES AND REVENUE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE fee_arrangement (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id            UUID NOT NULL REFERENCES party(id),
    household_id        UUID REFERENCES household_group(id),
    fee_type            TEXT NOT NULL CHECK (fee_type IN ('asset_based', 'fixed', 'hourly', 'insurance_commission', 'other')),
    amount              NUMERIC(12,2), -- dollar amount or basis points
    basis_points        NUMERIC(5,2), -- if asset-based
    collection_method   TEXT DEFAULT 'cma_deduction' CHECK (collection_method IN ('cma_deduction', 'invoice', 'platform_deduction', 'other')),
    start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    anniversary_date    DATE,
    end_date            DATE,
    consent_id          UUID REFERENCES consent(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fee_disclosure_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id          UUID NOT NULL REFERENCES fee_arrangement(id),
    event_type      TEXT NOT NULL CHECK (event_type IN ('fds_issued', 'fds_acknowledged', 'ofa_renewed', 'ofa_terminated')),
    event_date      DATE NOT NULL,
    document_id     UUID,
    outcome         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 9: DOCUMENTS AND FILE NOTES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE document (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_party_id      UUID REFERENCES party(id),
    household_id        UUID REFERENCES household_group(id),
    engagement_id       UUID REFERENCES engagement(id),
    document_type       TEXT NOT NULL, -- 'soa', 'roa', 'fds', 'id_document', 'insurance_policy', 'meeting_notes', 'correspondence', 'other'
    category            TEXT,
    title               TEXT NOT NULL,
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'signed', 'superseded', 'archived')),
    sharepoint_url      TEXT, -- link to SharePoint
    latest_version_id   UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_owner ON document(owner_party_id);
CREATE INDEX idx_doc_household ON document(household_id);
CREATE INDEX idx_doc_engagement ON document(engagement_id);

CREATE TABLE document_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES document(id),
    version_no      INTEGER NOT NULL,
    storage_uri     TEXT NOT NULL, -- SharePoint path
    filename        TEXT,
    mime_type       TEXT,
    checksum        TEXT,
    uploaded_by     UUID REFERENCES user_account(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE file_note (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id        UUID REFERENCES party(id),
    household_id    UUID REFERENCES household_group(id),
    engagement_id   UUID REFERENCES engagement(id),
    note_type       TEXT DEFAULT 'general' CHECK (note_type IN (
        'general', 'meeting', 'phone_call', 'email', 'ai_summary', 'compliance', 'other'
    )),
    text            TEXT NOT NULL,
    audio_ref       TEXT, -- SharePoint link to audio file
    author_user_id  UUID NOT NULL REFERENCES user_account(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fn_party ON file_note(party_id);
CREATE INDEX idx_fn_household ON file_note(household_id);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 10: COMPLIANCE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE complaint (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id                UUID NOT NULL REFERENCES party(id),
    category                TEXT NOT NULL,
    description             TEXT NOT NULL,
    lodged_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledgement_date    DATE,
    outcome_requested       TEXT,
    status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'escalated_afca', 'closed')),
    resolved_at             TIMESTAMPTZ,
    resolution_notes        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE compliance_register (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    register_type   TEXT NOT NULL CHECK (register_type IN (
        'breach', 'conflict_of_interest', 'gift_entertainment', 'ar_register', 'cpd'
    )),
    party_id        UUID REFERENCES party(id),
    user_id         UUID REFERENCES user_account(id),
    description     TEXT NOT NULL,
    date_recorded   DATE NOT NULL DEFAULT CURRENT_DATE,
    status          TEXT DEFAULT 'open',
    resolution      TEXT,
    resolved_date   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 11: WORKFLOW ORCHESTRATOR SUPPORT
-- State fields the orchestrator reads and writes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE workflow_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    description     TEXT,
    stages          JSONB NOT NULL, -- ordered array of {stage_code, stage_name, entry_conditions, exit_conditions, side_effects}
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'deployed', 'retired')),
    deployed_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES user_account(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wft_name_version ON workflow_template(name, version);

CREATE TABLE workflow_instance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES workflow_template(id),
    template_version    INTEGER NOT NULL,
    engagement_id       UUID REFERENCES engagement(id),
    household_id        UUID REFERENCES household_group(id),
    party_id            UUID REFERENCES party(id),
    current_stage       TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'error')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    last_event_at       TIMESTAMPTZ,
    context_data        JSONB DEFAULT '{}', -- workflow-specific state
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wfi_status ON workflow_instance(status);
CREATE INDEX idx_wfi_engagement ON workflow_instance(engagement_id);
CREATE INDEX idx_wfi_stage ON workflow_instance(current_stage);

CREATE TABLE workflow_event (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         UUID NOT NULL REFERENCES workflow_instance(id),
    event_type          TEXT NOT NULL, -- 'stage_entered', 'stage_exited', 'task_created', 'email_sent', 'document_signed', 'meeting_completed', 'timer_expired', 'error'
    from_stage          TEXT,
    to_stage            TEXT,
    payload             JSONB DEFAULT '{}',
    triggered_by        TEXT, -- 'orchestrator', 'user', 'external', 'timer'
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_we_instance ON workflow_event(instance_id);
CREATE INDEX idx_we_occurred ON workflow_event(occurred_at);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 12: AUDIT TRAIL
-- Append-only — NEVER update or delete
-- ══════════════════════════════════════════════════════════════

CREATE TABLE audit_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'export', 'workflow_action', 'api_call'
    actor_type      TEXT NOT NULL CHECK (actor_type IN ('user', 'portal', 'system', 'api')),
    actor_id        UUID,
    subject_type    TEXT NOT NULL, -- table name
    subject_id      UUID NOT NULL,
    details         JSONB DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_subject ON audit_event(subject_type, subject_id);
CREATE INDEX idx_audit_actor ON audit_event(actor_id);
CREATE INDEX idx_audit_occurred ON audit_event(occurred_at);

-- ══════════════════════════════════════════════════════════════
-- DOMAIN 13: EXTERNAL INTEGRATIONS
-- Links to Monday.com, Outlook, SharePoint, DocuSign, etc.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE external_link (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT NOT NULL, -- 'party', 'engagement', 'document', 'task', etc.
    entity_id       UUID NOT NULL,
    system_code     TEXT NOT NULL CHECK (system_code IN (
        'monday', 'sharepoint', 'outlook', 'docusign', 'plutosoft',
        'myprosperity', 'finametrica', 'omnium', 'mailchimp', 'calendly', 'xplan_legacy'
    )),
    external_id     TEXT NOT NULL,
    sync_state      TEXT DEFAULT 'synced' CHECK (sync_state IN ('synced', 'pending', 'error', 'stale')),
    last_synced_at  TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ext_link ON external_link(entity_type, entity_id, system_code);
CREATE INDEX idx_ext_system ON external_link(system_code);

-- ══════════════════════════════════════════════════════════════
-- HELPER VIEWS
-- ══════════════════════════════════════════════════════════════

-- Full person view with party fields
CREATE VIEW v_person AS
SELECT
    p.id, p.display_name, p.status AS party_status,
    per.legal_given_name, per.legal_family_name, per.preferred_name,
    per.date_of_birth, per.mobile_phone, per.email_primary,
    per.relationship_status, per.country_of_residence
FROM party p
JOIN person per ON per.id = p.id
WHERE p.archived_at IS NULL;

-- Full organisation view
CREATE VIEW v_organisation AS
SELECT
    p.id, p.display_name, p.status AS party_status,
    o.entity_type, o.legal_entity_name, o.trading_name,
    o.abn, o.acn, o.entity_status
FROM party p
JOIN organisation o ON o.id = p.id
WHERE p.archived_at IS NULL;

-- Household with members
CREATE VIEW v_household_members AS
SELECT
    hg.id AS household_id, hg.household_name,
    hm.party_id, hm.role_in_household,
    p.display_name, p.party_type
FROM household_group hg
JOIN household_member hm ON hm.household_id = hg.id AND hm.end_date IS NULL
JOIN party p ON p.id = hm.party_id
WHERE hg.archived_at IS NULL;

-- Active workflow instances
CREATE VIEW v_active_workflows AS
SELECT
    wi.id, wi.current_stage, wi.status,
    wt.name AS template_name, wt.version AS template_version,
    wi.started_at, wi.last_event_at,
    hg.household_name, p.display_name AS party_name
FROM workflow_instance wi
JOIN workflow_template wt ON wt.id = wi.template_id
LEFT JOIN household_group hg ON hg.id = wi.household_id
LEFT JOIN party p ON p.id = wi.party_id
WHERE wi.status = 'active';

-- Review cycle dashboard
CREATE VIEW v_upcoming_reviews AS
SELECT
    rc.id, rc.due_date, rc.status, rc.review_type,
    e.engagement_type, e.primary_adviser_id,
    hg.household_name,
    ua.name AS adviser_name
FROM review_cycle rc
JOIN engagement e ON e.id = rc.engagement_id
LEFT JOIN household_group hg ON hg.id = e.household_id
LEFT JOIN user_account ua ON ua.id = e.primary_adviser_id
WHERE rc.status IN ('scheduled', 'overdue')
ORDER BY rc.due_date;
