/*
 * TU-4 / Round 2 Half A check-constrained text column survey, Azure production,
 * 2026-04-29.
 *
 * Nullable columns covered by empty-string-to-null coercion:
 * - person.relationship_status
 * - person.resident_status
 * - person.tax_resident_status
 * - person.portal_access_preference
 * - person.preferred_contact_method
 * - client_classification.lifecycle_stage
 * - client_classification.service_segment
 * - client_classification.service_tier
 * - household_member.relation
 * - centrelink_detail.benefit_type
 * - centrelink_detail.concession_card_type
 *
 * Out of scope for coercion -- UI must enforce real values:
 * - party.communication_preference (NOT NULL, default 'auto')
 * - party.party_type (NOT NULL)
 * - party.status (NOT NULL, default 'active')
 * - employment_profile.employment_status (NOT NULL)
 * - household_member.role_in_household (NOT NULL, default 'member'; route validation handles blanks)
 */

export const CHECK_CONSTRAINED_PERSON_FIELDS = [
  "relationship_status",
  "resident_status",
  "tax_resident_status",
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

export const CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS = [
  "relation",
  "role_in_household",
] as const

export const CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS = [
  "benefit_type",
  "concession_card_type",
] as const

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
