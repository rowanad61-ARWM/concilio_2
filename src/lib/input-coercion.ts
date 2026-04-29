/*
 * TU-4 check-constrained text column survey, Azure production, 2026-04-29.
 *
 * Nullable columns covered by empty-string-to-null coercion:
 * - person.relationship_status
 * - person.portal_access_preference
 * - person.preferred_contact_method
 * - client_classification.lifecycle_stage
 * - client_classification.service_segment
 * - client_classification.service_tier
 *
 * Out of scope for coercion -- UI must enforce real values:
 * - party.communication_preference (NOT NULL, default 'auto')
 * - party.party_type (NOT NULL)
 * - party.status (NOT NULL, default 'active')
 * - employment_profile.employment_status (NOT NULL)
 */

export const CHECK_CONSTRAINED_PERSON_FIELDS = [
  "relationship_status",
  "portal_access_preference",
  "preferred_contact_method",
] as const

export const CHECK_CONSTRAINED_PARTY_FIELDS = [] as const

export const CHECK_CONSTRAINED_CLIENT_CLASSIFICATION_FIELDS = [
  "lifecycle_stage",
  "service_segment",
  "service_tier",
] as const

export const CHECK_CONSTRAINED_EMPLOYMENT_PROFILE_FIELDS = [] as const

export function coerceEmptyToNull<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): T {
  const next = { ...obj } as Record<string, unknown>

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(next, field) && next[field] === "") {
      next[field] = null
    }
  }

  return next as T
}
