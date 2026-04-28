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
} as const

export type DesignatedAlertEntityType = keyof typeof DESIGNATED_ALERT_FIELDS
