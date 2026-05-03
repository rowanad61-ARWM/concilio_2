export const EXTRACTABLE_FACTS_VERSION = "v1"

export type ExtractableFactCategory =
  | "identity"
  | "contact"
  | "employment"
  | "household"
  | "estate"
  | "centrelink"

export type ExtractableFactPartyScope = "primary" | "household"

export type ExtractableFactValueType = "string" | "date" | "boolean" | "integer" | "decimal"

export type ExtractableFact = {
  table: "person" | "employment_profile" | "centrelink_detail" | "household_group"
  column: string
  category: ExtractableFactCategory
  description: string
  party_scope: ExtractableFactPartyScope
  value_type: ExtractableFactValueType
}

export type ParkOnlyCategory = {
  category: string
  description: string
}

export const EXTRACTABLE_FACTS: ExtractableFact[] = [
  {
    table: "person",
    column: "title",
    category: "identity",
    description: "the client's title or honorific, plain text",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "legal_given_name",
    category: "identity",
    description: "the client's legal given name",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "legal_middle_names",
    category: "identity",
    description: "the client's legal middle name or names",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "legal_family_name",
    category: "identity",
    description: "the client's legal family name",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "preferred_name",
    category: "identity",
    description: "the name the client prefers to be called",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "date_of_birth",
    category: "identity",
    description: "the client's date of birth, ISO 8601 date format; flag conflicts with existing imported values",
    party_scope: "primary",
    value_type: "date",
  },
  {
    table: "person",
    column: "gender",
    category: "identity",
    description: "the client's gender, plain text exactly as stated",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "gender_pronouns",
    category: "identity",
    description: "the client's stated pronouns, plain text",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "place_of_birth",
    category: "identity",
    description: "the city, town, or place where the client was born",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "country_of_birth",
    category: "identity",
    description: "the country where the client was born",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "relationship_status",
    category: "identity",
    description: "the client's relationship status, such as married, partnered, single, divorced, or widowed",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "country_of_residence",
    category: "identity",
    description: "the country where the client currently resides",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "resident_status",
    category: "identity",
    description: "the client's residency status, plain text",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "mobile_phone",
    category: "contact",
    description: "the client's mobile phone number, plain text as stated",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "email_primary",
    category: "contact",
    description: "the client's primary email address",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "email_alternate",
    category: "contact",
    description: "the client's alternate email address",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "preferred_contact_method",
    category: "contact",
    description: "the client's preferred contact method, such as phone, email, SMS, or portal",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "preferred_contact_time",
    category: "contact",
    description: "the client's preferred contact time or availability window",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "communication_exclusions",
    category: "contact",
    description: "communication channels or topics the client has asked the firm not to use",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "emergency_contact_name",
    category: "contact",
    description: "the client's emergency contact name",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "emergency_contact_relationship",
    category: "contact",
    description: "the emergency contact's relationship to the client",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "emergency_contact_phone",
    category: "contact",
    description: "the emergency contact's phone number",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "emergency_contact_email",
    category: "contact",
    description: "the emergency contact's email address",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "emergency_contact_notes",
    category: "contact",
    description: "short notes about the emergency contact context",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "country_of_tax_residency",
    category: "identity",
    description: "the client's country of tax residency",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "tax_resident_status",
    category: "identity",
    description: "the client's tax residency status, plain text",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "employment_profile",
    column: "employment_status",
    category: "employment",
    description:
      "the client's current employment status; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "employment_profile",
    column: "employer_business_name",
    category: "employment",
    description:
      "the client's current employer or business name; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "employment_profile",
    column: "occupation_title",
    category: "employment",
    description:
      "the client's occupation or role title; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "employment_profile",
    column: "industry",
    category: "employment",
    description:
      "the client's industry; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "employment_profile",
    column: "start_date",
    category: "employment",
    description:
      "the date the client started the current role or business, ISO 8601 date format; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "date",
  },
  {
    table: "employment_profile",
    column: "target_retirement_date",
    category: "employment",
    description:
      "the client's target retirement date, ISO 8601 date format; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "date",
  },
  {
    table: "employment_profile",
    column: "target_retirement_age",
    category: "employment",
    description:
      "the client's target retirement age as a whole number; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "integer",
  },
  {
    table: "employment_profile",
    column: "annual_salary",
    category: "employment",
    description:
      "the client's annual salary amount as a non-negative decimal number; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "decimal",
  },
  {
    table: "employment_profile",
    column: "salary_sacrifice",
    category: "employment",
    description:
      "the client's salary sacrifice amount as a non-negative decimal number; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "decimal",
  },
  {
    table: "employment_profile",
    column: "notes",
    category: "employment",
    description:
      "brief employment context notes; publish updates the latest active employment_profile row for this party, or creates one if none exists",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "household_group",
    column: "finance_style",
    category: "household",
    description: "how the household tends to manage financial decisions together, plain text",
    party_scope: "household",
    value_type: "string",
  },
  {
    table: "household_group",
    column: "household_notes",
    category: "household",
    description: "general notes about the client's household context",
    party_scope: "household",
    value_type: "string",
  },
  {
    table: "person",
    column: "will_exists",
    category: "estate",
    description: "whether the client says they have a will, boolean true or false",
    party_scope: "primary",
    value_type: "boolean",
  },
  {
    table: "person",
    column: "will_is_current",
    category: "estate",
    description: "whether the client's will is current, boolean true or false",
    party_scope: "primary",
    value_type: "boolean",
  },
  {
    table: "person",
    column: "will_date",
    category: "estate",
    description: "the date of the client's will, ISO 8601 date format",
    party_scope: "primary",
    value_type: "date",
  },
  {
    table: "person",
    column: "will_location",
    category: "estate",
    description: "where the client's will is stored",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "estate_planning_notes",
    category: "estate",
    description: "estate planning context or notes that do not fit a more specific scalar field",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "person",
    column: "funeral_plan_status",
    category: "estate",
    description: "the client's funeral plan status, such as in_place, pre_paid, not_in_place, or unknown",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "centrelink_detail",
    column: "is_eligible",
    category: "centrelink",
    description: "whether the client is eligible for Centrelink benefits, boolean true or false",
    party_scope: "primary",
    value_type: "boolean",
  },
  {
    table: "centrelink_detail",
    column: "benefit_type",
    category: "centrelink",
    description: "the Centrelink benefit type, such as age_pension, disability_support, family_payments, carer_payment, jobseeker, none, or other",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "centrelink_detail",
    column: "has_concession_card",
    category: "centrelink",
    description: "whether the client has a concession card, boolean true or false",
    party_scope: "primary",
    value_type: "boolean",
  },
  {
    table: "centrelink_detail",
    column: "concession_card_type",
    category: "centrelink",
    description: "the type of concession card, such as pensioner_concession_card, cshc, hcc, or other",
    party_scope: "primary",
    value_type: "string",
  },
  {
    table: "centrelink_detail",
    column: "has_gifted_assets",
    category: "centrelink",
    description: "whether the client has gifted assets relevant to Centrelink, boolean true or false",
    party_scope: "primary",
    value_type: "boolean",
  },
  {
    table: "centrelink_detail",
    column: "notes",
    category: "centrelink",
    description: "Centrelink context notes excluding CRN or other government identity numbers",
    party_scope: "primary",
    value_type: "string",
  },
]

export const PARK_ONLY_CATEGORIES: ParkOnlyCategory[] = [
  {
    category: "investment_holdings",
    description: "specific investment products, balances, providers, terms, maturities, and strategy context",
  },
  {
    category: "insurance_policies",
    description: "life, TPD, income protection, health, or other insurance policies, providers, and sums insured",
  },
  {
    category: "financial_goals",
    description: "short or long term goals such as retirement age, target income, target balance, lifestyle, family, or legacy goals",
  },
  {
    category: "liabilities",
    description: "mortgages, personal loans, credit cards, business debts, repayment details, offsets, and lender context",
  },
  {
    category: "income_expense_detail",
    description: "detailed income, spending, cashflow, or budget facts beyond the employment profile scalar fields",
  },
  {
    category: "property_assets",
    description: "home, investment property, business real property, valuations, mortgages, and rental details",
  },
  {
    category: "super_pension_accounts",
    description: "superannuation or pension account providers, balances, member numbers, nominations, investment options, and BPAY details",
  },
  {
    category: "professional_contacts",
    description: "accountants, solicitors, brokers, doctors, or other professional contacts mentioned in conversation",
  },
  {
    category: "estate_people",
    description: "executors, beneficiaries, powers of attorney, trustees, charities, or other estate-planning people and entities",
  },
  {
    category: "household_members",
    description: "spouses, partners, dependants, adult children, family roles, and household-member details",
  },
  {
    category: "other",
    description: "real and useful facts that do not yet have a covered schema field",
  },
]

export function resolveTarget(category: string, columnName: string) {
  const normalizedCategory = category.trim()
  const normalizedColumn = columnName.trim()
  return (
    EXTRACTABLE_FACTS.find(
      (fact) =>
        fact.category === normalizedCategory &&
        (fact.column === normalizedColumn || `${fact.table}.${fact.column}` === normalizedColumn),
    ) ?? null
  )
}

export function resolveTableColumnTarget(table: string, column: string) {
  return EXTRACTABLE_FACTS.find((fact) => fact.table === table && fact.column === column) ?? null
}
