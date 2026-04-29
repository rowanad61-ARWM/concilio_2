export const DESIGNATED_ALERT_FIELDS = {
  person: [
    "email",
    "mobile",
    "postal_address.street",
    "postal_address.suburb",
    "postal_address.state",
    "postal_address.postcode",
  ],
  financial_account: ["account_name", "account_number"],
  centrelink_detail: ["crn"],
  power_of_attorney: ["first_name", "surname"],
  estate_executor: ["first_name", "surname"],
  super_pension_account: ["provider_name", "member_number"],
} as const

export type DesignatedAlertEntityType = keyof typeof DESIGNATED_ALERT_FIELDS
