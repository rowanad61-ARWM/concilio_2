const FIELD_LABELS: Record<string, string> = {
  "person.email": "Email",
  "person.email_primary": "Email",
  "person.mobile": "Mobile",
  "person.mobile_phone": "Mobile",
  "person.phone": "Phone",
  "person.first_name": "First name",
  "person.last_name": "Last name",
  "person.legal_given_name": "First name",
  "person.legal_family_name": "Last name",
  "person.legal_middle_names": "Middle names",
  "person.preferred_name": "Preferred name",
  "person.date_of_birth": "Date of birth",
  "person.relationship_status": "Relationship status",
  "person.country_of_residence": "Country of residence",
  "person.country_of_birth": "Country of birth",
  "person.tax_resident_status": "Tax resident status",
  "person.resident_status": "Resident status",
  "person.gender": "Gender",
  "person.title": "Title",
  "person.initials": "Initials",
  "person.is_pep_risk": "PEP risk",
  "person.pep_notes": "PEP notes",
  "person.postal_address.street": "Postal street",
  "person.postal_address.suburb": "Postal suburb",
  "person.postal_address.state": "Postal state",
  "person.postal_address.postcode": "Postal postcode",
  "financial_account.account_name": "Account name",
  "financial_account.account_number": "Account number",
  "financial_account.bsb": "BSB",
  "centrelink_detail.crn": "CRN",
  "power_of_attorney.first_name": "Attorney first name",
  "power_of_attorney.surname": "Attorney surname",
  "estate_executor.first_name": "Executor first name",
  "estate_executor.surname": "Executor surname",
  "super_pension_account.provider_name": "Super provider",
  "super_pension_account.member_number": "Member number",
}

const ENTITY_LABELS: Record<string, string> = {
  audit_event: "Audit Event",
  alert: "Alert",
  alert_instance: "Alert",
  centrelink_detail: "Centrelink Detail",
  client: "Person",
  client_classification: "Client Classification",
  document: "Document",
  email_in: "Email",
  email_out: "Email",
  EmailLog: "Email",
  emaillog: "Email",
  engagement: "Engagement",
  estate_beneficiary: "Estate Beneficiary",
  estate_executor: "Estate Executor",
  file_note: "File Note",
  financial_account: "Financial Account",
  household_group: "Household",
  household_member: "Household Member",
  income_item: "Income Item",
  liability: "Liability",
  meeting: "Meeting",
  party: "Party",
  person: "Person",
  phone_call: "Phone Call",
  portal_message: "Portal Message",
  power_of_attorney: "Power Of Attorney",
  professional_relationship: "Professional Relationship",
  property_asset: "Property Asset",
  risk_profile: "Risk Profile",
  sharepointfile: "Document",
  sharepointfolder: "Document Folder",
  sms_in: "SMS",
  sms_out: "SMS",
  super_pension_account: "Super/Pension Account",
  system: "System",
  task: "Task",
  Task: "Task",
  timeline_entry: "Timeline Entry",
  verification_check: "Verification Check",
  workflow_event: "Workflow Event",
  workflow_instance: "Workflow",
}

const ACTION_LABELS: Record<string, string> = {
  ARCHIVE: "archived",
  CREATE: "created",
  DELETE: "deleted",
  DRIVER_ACTION_RECORDED: "driver action recorded",
  LOGIN: "logged in",
  LOGIN_FAIL: "login failed",
  LOGIN_SUCCESS: "login succeeded",
  NUDGE_FIRED: "nudge fired",
  OUTCOME_SET: "outcome set",
  SEND_COMMS: "communication sent",
  UPDATE: "updated",
  VIEW_SENSITIVE: "sensitive field viewed",
  WORKFLOW_ADVANCED: "advanced",
  WORKFLOW_SPAWNED: "started",
  WORKFLOW_STOPPED: "stopped",
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  )
}

function renderValue(value: unknown) {
  if (isEmptyValue(value)) {
    return "(empty)"
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    return `'${value}'`
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }

  return JSON.stringify(value)
}

export function humanFieldName(qualifiedFieldName: string): string {
  return FIELD_LABELS[qualifiedFieldName] ?? qualifiedFieldName
}

export function humanEntityName(entity_type: string): string {
  return ENTITY_LABELS[entity_type] ?? ENTITY_LABELS[entity_type.toLowerCase()] ?? titleCase(entity_type)
}

export function humanAction(action: string): string {
  return ACTION_LABELS[action] ?? titleCase(action).toLowerCase()
}

export function describeFieldChange(
  oldVal: unknown,
  newVal: unknown,
): { verb: string; summary: string } {
  const oldEmpty = isEmptyValue(oldVal)
  const newEmpty = isEmptyValue(newVal)
  const verb = oldEmpty && !newEmpty ? "set" : !oldEmpty && newEmpty ? "cleared" : "updated"

  return {
    verb,
    summary: `Changed from ${renderValue(oldVal)} -> ${renderValue(newVal)}`,
  }
}
