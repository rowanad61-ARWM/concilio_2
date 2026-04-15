import { notFound } from "next/navigation"

import ClientRecord from "@/components/clients/ClientRecord"
import { db } from "@/lib/db"
import { mapEngagementRow } from "@/lib/engagement"
import type { ClientAddress } from "@/types/client-record"
import type { ClientDetail, TimelineNote } from "@/types/client-record"

type HouseholdMemberWithParty = Prisma.household_memberGetPayload<{
  include: { party: true }
}>

function mapAddress(value: unknown): ClientAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const address = value as Record<string, unknown>
  return {
    line1: typeof address.line1 === "string" ? address.line1 : null,
    line2: typeof address.line2 === "string" ? address.line2 : null,
    suburb: typeof address.suburb === "string" ? address.suburb : null,
    state: typeof address.state === "string" ? address.state : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
    country: typeof address.country === "string" ? address.country : null,
  }
}

function mapVerificationResult(value: string) {
  switch (value.toLowerCase()) {
    case "verified":
      return "pass"
    case "failed":
    case "expired":
      return "fail"
    case "pass":
    case "pending":
    case "fail":
      return value.toLowerCase()
    default:
      return "pending"
  }
}

export default async function ClientRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [party, fileNotes, householdMembership, verificationChecks, employmentProfile, riskProfile] = await Promise.all([
    db.party.findUnique({
      where: { id },
      include: {
        person: true,
        contact_method: true,
        client_classification: true,
      },
    }),
    db.file_note.findMany({
      where: {
        party_id: id,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 50,
    }),
    db.household_member.findFirst({
      where: {
        party_id: id,
        end_date: null,
      },
      include: {
        household_group: true,
      },
    }),
    db.verification_check.findMany({
      where: {
        party_id: id,
      },
      orderBy: {
        created_at: "desc",
      },
    }),
    db.employment_profile.findFirst({
      where: {
        party_id: id,
        effective_to: null,
      },
      orderBy: [
        {
          effective_from: "desc",
        },
        {
          created_at: "desc",
        },
      ],
    }),
    db.risk_profile.findFirst({
      where: {
        party_id: id,
      },
      orderBy: [
        {
          completed_at: "desc",
        },
        {
          created_at: "desc",
        },
      ],
    }),
  ])

  if (!party) {
    notFound()
  }

  const [householdMembers, engagementRows] = householdMembership
    ? await Promise.all([
        db.household_member.findMany({
          where: {
            household_id: householdMembership.household_id,
            end_date: null,
          },
          include: {
            party: true,
          },
          orderBy: {
            created_at: "asc",
          },
        }),
        db.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT
             e.*,
             wi.id AS workflow_instance_id,
             wi.current_stage AS workflow_current_stage,
             wi.status AS workflow_status,
             wt.stages AS workflow_template_stages
           FROM engagement e
           LEFT JOIN LATERAL (
             SELECT wi_inner.*
             FROM workflow_instance wi_inner
             WHERE wi_inner.engagement_id = e.id
             ORDER BY wi_inner.created_at DESC
             LIMIT 1
           ) wi ON true
           LEFT JOIN workflow_template wt ON wt.id = wi.template_id
           WHERE e.household_id = $1
           ORDER BY e.created_at DESC`,
          householdMembership.household_id,
        ),
      ])
    : [[], []]

  const client: ClientDetail = {
    id: party.id,
    displayName: party.display_name,
    partyType: party.party_type,
    status: party.status,
    updatedAt: party.updated_at.toISOString(),
    household: householdMembership
      ? {
          id: householdMembership.household_group.id,
          name: householdMembership.household_group.household_name,
          role: householdMembership.role_in_household,
          members: householdMembers.map((member: HouseholdMemberWithParty) => ({
            id: member.party.id,
            displayName: member.party.display_name,
            role: member.role_in_household,
          })),
        }
      : null,
    classification: party.client_classification
      ? {
          serviceTier: party.client_classification.service_tier,
          lifecycleStage: party.client_classification.lifecycle_stage,
        }
      : null,
    person: party.person
      ? {
          legalGivenName: party.person.legal_given_name,
          legalFamilyName: party.person.legal_family_name,
          preferredName: party.person.preferred_name,
          dateOfBirth: party.person.date_of_birth?.toISOString() ?? null,
          mobilePhone: party.person.mobile_phone,
          emailPrimary: party.person.email_primary,
          relationshipStatus: party.person.relationship_status,
          countryOfResidence: party.person.country_of_residence,
          preferredContactMethod: party.person.preferred_contact_method,
          addressResidential: mapAddress(party.person.address_residential),
          addressPostal: mapAddress(party.person.address_postal),
        }
      : null,
    contactMethods: party.contact_method.map((contactMethod) => ({
      id: contactMethod.id,
      channel: contactMethod.channel,
      value: contactMethod.value,
      isPrimary: contactMethod.preferred_flag ?? false,
    })),
    verificationChecks: verificationChecks.map((check) => ({
      id: check.id,
      checkType: check.check_type,
      documentType: check.identity_document_type,
      documentReference: check.document_reference,
      result: mapVerificationResult(check.result),
      verifiedAt: check.verified_at?.toISOString() ?? null,
      expiryDate: check.expiry_date?.toISOString() ?? null,
      notes: check.notes,
    })),
    employment: employmentProfile
      ? {
          employmentStatus: employmentProfile.employment_status,
          employerName: employmentProfile.employer_business_name,
          occupation: employmentProfile.occupation_title,
          industry: employmentProfile.industry,
          employmentType: null,
        }
      : null,
    riskProfile: riskProfile
      ? {
          id: riskProfile.id,
          riskResult: riskProfile.risk_result,
          score: riskProfile.score,
          capacityForLoss: riskProfile.capacity_for_loss,
          overrideFlag: riskProfile.override_flag ?? false,
          overrideReason: riskProfile.override_reason,
          completedAt: riskProfile.completed_at?.toISOString() ?? null,
          validUntil: riskProfile.valid_until?.toISOString() ?? null,
        }
      : null,
    engagements: engagementRows.map((engagement) => mapEngagementRow(engagement)),
  }

  const notes: TimelineNote[] = fileNotes.map((note) => ({
    id: note.id,
    noteType: note.note_type ?? "internal",
    text: note.text,
    createdAt: note.created_at.toISOString(),
  }))

  return <ClientRecord client={client} notes={notes} />
}
