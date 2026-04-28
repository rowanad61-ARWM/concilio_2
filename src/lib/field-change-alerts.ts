import { DESIGNATED_ALERT_FIELDS } from "@/lib/audit-config"

export type FieldChangeAlert = {
  field: string
  old: unknown
  new: unknown
}

const SNAPSHOT_PATH_ALIASES: Record<string, string[]> = {
  "person.email": ["email", "person.email_primary", "email_primary"],
  "person.mobile": ["mobile", "person.mobile_phone", "mobile_phone"],
  "person.postal_address.street": [
    "postal_address.street",
    "postal_address.line1",
    "person.address_postal.street",
    "person.address_postal.line1",
    "address_postal.street",
    "address_postal.line1",
  ],
  "person.postal_address.suburb": [
    "postal_address.suburb",
    "person.address_postal.suburb",
    "address_postal.suburb",
  ],
  "person.postal_address.state": [
    "postal_address.state",
    "person.address_postal.state",
    "address_postal.state",
  ],
  "person.postal_address.postcode": [
    "postal_address.postcode",
    "person.address_postal.postcode",
    "address_postal.postcode",
  ],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function valueAtPath(source: unknown, path: string): unknown {
  if (!isRecord(source)) {
    return undefined
  }

  let current: unknown = source
  for (const segment of path.split(".")) {
    if (!isRecord(current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function candidatePaths(entityType: string, field: string): string[] {
  return SNAPSHOT_PATH_ALIASES[`${entityType}.${field}`] ?? [field]
}

function readDesignatedValue(
  entityType: string,
  field: string,
  snapshot: Record<string, unknown>,
): unknown {
  for (const path of candidatePaths(entityType, field)) {
    const value = valueAtPath(snapshot, path)
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function detectFieldChanges(
  entityType: string,
  before: object | null,
  after: object | null,
): FieldChangeAlert[] {
  if (!isRecord(before) || !isRecord(after)) {
    return []
  }

  const fields =
    DESIGNATED_ALERT_FIELDS[entityType as keyof typeof DESIGNATED_ALERT_FIELDS]
  if (!fields) {
    return []
  }

  const changes: FieldChangeAlert[] = []

  for (const field of fields) {
    const oldValue = readDesignatedValue(entityType, field, before)
    const newValue = readDesignatedValue(entityType, field, after)

    if (!valuesEqual(oldValue, newValue)) {
      changes.push({
        field,
        old: oldValue ?? null,
        new: newValue ?? null,
      })
    }
  }

  return changes
}
