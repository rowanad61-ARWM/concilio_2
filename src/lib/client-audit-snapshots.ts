import { db } from '@/lib/db'
import type { AuditSnapshot } from '@/lib/audit'
import type { AuditLifecycleContext } from '@/lib/audit-middleware'

export type ClientRouteContext = { params: Promise<{ id: string }> }

export async function routeParamId(context: ClientRouteContext): Promise<string> {
  const { id } = await context.params
  return id
}

export async function responseJson<T>(
  auditContext: AuditLifecycleContext,
): Promise<T | null> {
  if (!auditContext.response) {
    return null
  }

  try {
    return (await auditContext.response.clone().json()) as T
  } catch {
    return null
  }
}

export async function responseId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ id?: unknown }>(auditContext)
  return typeof payload?.id === 'string' ? payload.id : null
}

export async function responseItemId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ item?: { id?: unknown } }>(auditContext)
  return typeof payload?.item?.id === 'string' ? payload.item.id : null
}

export async function loadClientParentSnapshot(id: string): Promise<AuditSnapshot> {
  const party = await db.party.findUnique({
    where: { id },
    select: {
      id: true,
      party_type: true,
      display_name: true,
      status: true,
      communication_preference: true,
      created_at: true,
      updated_at: true,
      archived_at: true,
      person: {
        select: {
          id: true,
          legal_given_name: true,
          legal_middle_names: true,
          legal_family_name: true,
          preferred_name: true,
          previous_names: true,
          date_of_birth: true,
          gender_pronouns: true,
          mobile_phone: true,
          email_primary: true,
          email_alternate: true,
          address_residential: true,
          address_postal: true,
          preferred_contact_method: true,
          preferred_contact_time: true,
          communication_exclusions: true,
          citizenships: true,
          country_of_residence: true,
          relationship_status: true,
          relationship_status_date: true,
          portal_access_preference: true,
          accessibility_needs: true,
          person_status_notes: true,
          created_at: true,
          updated_at: true,
        },
      },
      client_classification: true,
    },
  })

  return party
}

export async function loadClientRecordSnapshot(id: string): Promise<AuditSnapshot> {
  const [parent, currentEmployment] = await Promise.all([
    loadClientParentSnapshot(id),
    db.employment_profile.findFirst({
      where: {
        party_id: id,
        effective_to: null,
      },
      orderBy: [
        { effective_from: 'desc' },
        { created_at: 'desc' },
      ],
    }),
  ])

  return parent
    ? {
        ...parent,
        current_employment: currentEmployment,
      }
    : null
}

export async function loadClassificationSnapshot(
  partyId: string,
): Promise<AuditSnapshot> {
  return db.client_classification.findUnique({
    where: { party_id: partyId },
  })
}

export async function loadPropertyAssetSnapshot(id: string): Promise<AuditSnapshot> {
  const [property, ownership] = await Promise.all([
    db.property_asset.findUnique({
      where: { id },
    }),
    db.ownership_interest.findMany({
      where: {
        target_id: id,
        target_type: {
          in: ['property', 'property_asset'],
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    }),
  ])

  return property
    ? {
        ...property,
        ownership_interest: ownership,
      }
    : null
}

export async function loadFinancialAccountSnapshot(
  id: string,
): Promise<AuditSnapshot> {
  return db.financial_account.findUnique({
    where: { id },
  })
}

export async function loadIncomeItemSnapshot(id: string): Promise<AuditSnapshot> {
  return db.income_item.findUnique({
    where: { id },
  })
}

export async function loadLiabilitySnapshot(id: string): Promise<AuditSnapshot> {
  return db.liability.findUnique({
    where: { id },
  })
}

export async function loadRiskProfileSnapshot(id: string): Promise<AuditSnapshot> {
  return db.risk_profile.findUnique({
    where: { id },
  })
}

export async function loadVerificationCheckSnapshot(
  id: string,
): Promise<AuditSnapshot> {
  return db.verification_check.findUnique({
    where: { id },
  })
}

export async function loadHouseholdSnapshot(id: string): Promise<AuditSnapshot> {
  const household = await db.household_group.findUnique({
    where: { id },
    include: {
      household_member: {
        orderBy: {
          created_at: 'asc',
        },
      },
    },
  })

  return household
}
