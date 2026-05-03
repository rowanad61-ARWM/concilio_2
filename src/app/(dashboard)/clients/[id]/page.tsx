import { notFound } from "next/navigation"

import ClientRecord from "@/components/clients/ClientRecord"
import { db } from "@/lib/db"
import { mapEngagementRow } from "@/lib/engagement"
import {
  resolveEmailForParty,
  resolveMobileForParty,
  resolvePreferredContactMethodForParty,
} from "@/lib/party-contact"
import type { ClientAddress } from "@/types/client-record"
import type { ClientDetail, TimelineNote } from "@/types/client-record"

type HouseholdMemberWithParty = any

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

function decimalToString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : null
  }

  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString()
  }

  return null
}

export default async function ClientRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [
    party,
    fileNotes,
    householdMembership,
    verificationChecks,
    employmentProfile,
    riskProfile,
    professionalRelationships,
    estateExecutors,
    estateBeneficiaries,
    powersOfAttorney,
    superPensionAccounts,
    centrelinkDetail,
    parkedFactsCount,
  ] = await Promise.all([
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
    db.professional_relationship.findMany({
      where: {
        person_id: id,
      },
      orderBy: [
        {
          created_at: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    db.estate_executor.findMany({
      where: {
        person_id: id,
      },
      orderBy: [
        {
          created_at: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    db.estate_beneficiary.findMany({
      where: {
        person_id: id,
      },
      orderBy: [
        {
          created_at: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    db.power_of_attorney.findMany({
      where: {
        person_id: id,
      },
      orderBy: [
        {
          created_at: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    db.super_pension_account.findMany({
      where: {
        person_id: id,
      },
      orderBy: [
        {
          created_at: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    db.centrelink_detail.findUnique({
      where: {
        person_id: id,
      },
    }),
    db.parked_fact.count({
      where: {
        party_id: id,
        status: "parked",
      },
    }),
  ])

  if (!party) {
    notFound()
  }

  const [householdMembers, engagementRows] = await Promise.all([
    householdMembership
      ? db.household_member.findMany({
          where: {
            household_id: householdMembership.household_id,
            end_date: null,
          },
          include: {
            party: {
              include: {
                person: true,
              },
            },
          },
          orderBy: {
            created_at: "asc",
          },
        })
      : Promise.resolve([]),
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
       WHERE e.party_id = $1
          OR ($2::uuid IS NOT NULL AND e.household_id = $2)
       ORDER BY e.created_at DESC`,
      id,
      householdMembership?.household_id ?? null,
    ),
  ])

  const seenEngagementIds = new Set<string>()
  const dedupedEngagementRows = engagementRows.filter((row) => {
    const rowId = typeof row.id === "string" ? row.id : ""
    if (!rowId || seenEngagementIds.has(rowId)) {
      return false
    }
    seenEngagementIds.add(rowId)
    return true
  })

  const client: ClientDetail = {
    id: party.id,
    displayName: party.display_name,
    partyType: party.party_type,
    status: party.status,
    updatedAt: party.updated_at.toISOString(),
    resolvedEmail: resolveEmailForParty(party),
    resolvedMobile: resolveMobileForParty(party),
    resolvedPreferredContactMethod: resolvePreferredContactMethodForParty(party),
    parkedFactsCount,
    household: householdMembership
      ? {
          id: householdMembership.household_group.id,
          name: householdMembership.household_group.household_name,
          salutationInformal: householdMembership.household_group.salutation_informal,
          addressTitleFormal: householdMembership.household_group.address_title_formal,
          householdNotes: householdMembership.household_group.household_notes,
          role: householdMembership.role_in_household,
          members: householdMembers.map((member: HouseholdMemberWithParty) => ({
            id: member.id,
            partyId: member.party.id,
            displayName: member.party.display_name,
            role: member.role_in_household,
            endDate: member.end_date?.toISOString() ?? null,
            relation: member.relation,
            isFinancialDependant: member.is_financial_dependant ?? false,
            dependantUntilAge: member.dependant_until_age,
            dependantNotes: member.dependant_notes,
            relationToMemberId: member.relation_to_member_id,
            dateOfBirth: member.party.person?.date_of_birth?.toISOString() ?? null,
            legalGivenName: member.party.person?.legal_given_name ?? null,
            legalFamilyName: member.party.person?.legal_family_name ?? null,
          })),
      }
      : null,
    professionalRelationships: professionalRelationships.map((relationship) => ({
      id: relationship.id,
      relationshipType: relationship.relationship_type,
      isAuthorised: relationship.is_authorised,
      authorisationExpiry: relationship.authorisation_expiry?.toISOString() ?? null,
      firstName: relationship.first_name,
      surname: relationship.surname,
      company: relationship.company,
      phone: relationship.phone,
      email: relationship.email,
      addressLine: relationship.address_line,
      addressSuburb: relationship.address_suburb,
      addressState: relationship.address_state,
      addressPostcode: relationship.address_postcode,
      notes: relationship.notes,
      createdAt: relationship.created_at.toISOString(),
      updatedAt: relationship.updated_at.toISOString(),
    })),
    estateExecutors: estateExecutors.map((executor) => ({
      id: executor.id,
      entityType: executor.entity_type,
      firstName: executor.first_name,
      surname: executor.surname,
      preferredName: executor.preferred_name,
      notes: executor.notes,
    })),
    estateBeneficiaries: estateBeneficiaries.map((beneficiary) => ({
      id: beneficiary.id,
      entityType: beneficiary.entity_type,
      firstName: beneficiary.first_name,
      surname: beneficiary.surname,
      preferredName: beneficiary.preferred_name,
      ageOfEntitlement: beneficiary.age_of_entitlement,
      notes: beneficiary.notes,
    })),
    powersOfAttorney: powersOfAttorney.map((powerOfAttorney) => ({
      id: powerOfAttorney.id,
      poaType: powerOfAttorney.poa_type,
      entityType: powerOfAttorney.entity_type,
      location: powerOfAttorney.location,
      firstName: powerOfAttorney.first_name,
      surname: powerOfAttorney.surname,
      preferredName: powerOfAttorney.preferred_name,
      notes: powerOfAttorney.notes,
    })),
    superPensionAccounts: superPensionAccounts.map((account) => ({
      id: account.id,
      accountType: account.account_type,
      providerName: account.provider_name,
      productName: account.product_name,
      memberNumber: account.member_number,
      currentBalance: decimalToString(account.current_balance),
      balanceAsAt: account.balance_as_at?.toISOString() ?? null,
      contributionsYtd: decimalToString(account.contributions_ytd),
      investmentOption: account.investment_option,
      insuranceInFundSummary: account.insurance_in_fund_summary,
      beneficiaryNominationType: account.beneficiary_nomination_type,
      beneficiaryNominationNotes: account.beneficiary_nomination_notes,
      bpayBillerCode: account.bpay_biller_code,
      bpayReference: account.bpay_reference,
      notes: account.notes,
    })),
    centrelink: centrelinkDetail
      ? {
          id: centrelinkDetail.id,
          isEligible: centrelinkDetail.is_eligible,
          benefitType: centrelinkDetail.benefit_type,
          crn: centrelinkDetail.crn,
          hasConcessionCard: centrelinkDetail.has_concession_card,
          concessionCardType: centrelinkDetail.concession_card_type,
          hasGiftedAssets: centrelinkDetail.has_gifted_assets,
          notes: centrelinkDetail.notes,
        }
      : null,
    classification: party.client_classification
      ? {
          serviceTier: party.client_classification.service_segment ?? party.client_classification.service_tier,
          lifecycleStage: party.client_classification.lifecycle_stage,
        }
      : null,
    person: party.person
      ? {
          title: party.person.title,
          legalGivenName: party.person.legal_given_name,
          legalMiddleNames: party.person.legal_middle_names,
          legalFamilyName: party.person.legal_family_name,
          initials: party.person.initials,
          preferredName: party.person.preferred_name,
          maidenName: party.person.maiden_name,
          mothersMaidenName: party.person.mothers_maiden_name,
          dateOfBirth: party.person.date_of_birth?.toISOString() ?? null,
          gender: party.person.gender,
          genderPronouns: party.person.gender_pronouns,
          placeOfBirth: party.person.place_of_birth,
          countryOfBirth: party.person.country_of_birth,
          mobilePhone: party.person.mobile_phone,
          emailPrimary: party.person.email_primary,
          emailAlternate: party.person.email_alternate,
          relationshipStatus: party.person.relationship_status,
          countryOfResidence: party.person.country_of_residence,
          residentStatus: party.person.resident_status,
          countryOfTaxResidency: party.person.country_of_tax_residency,
          taxResidentStatus: party.person.tax_resident_status,
          isPepRisk: party.person.is_pep_risk,
          pepNotes: party.person.pep_notes,
          willExists: party.person.will_exists,
          willIsCurrent: party.person.will_is_current,
          willDate: party.person.will_date?.toISOString() ?? null,
          willLocation: party.person.will_location,
          estatePlanningNotes: party.person.estate_planning_notes,
          funeralPlanStatus: party.person.funeral_plan_status,
          emergencyContactName: party.person.emergency_contact_name,
          emergencyContactRelationship: party.person.emergency_contact_relationship,
          emergencyContactPhone: party.person.emergency_contact_phone,
          emergencyContactEmail: party.person.emergency_contact_email,
          emergencyContactNotes: party.person.emergency_contact_notes,
          preferredContactMethod: party.person.preferred_contact_method,
          addressResidential: mapAddress(party.person.address_residential),
          addressPostal: mapAddress(party.person.address_postal),
        }
      : null,
    contactMethods: party.contact_method.map((contactMethod: any) => ({
      id: contactMethod.id,
      channel: contactMethod.channel,
      value: contactMethod.value,
      isPrimary: contactMethod.preferred_flag ?? false,
    })),
    verificationChecks: verificationChecks.map((check: any) => ({
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
    engagements: dedupedEngagementRows.map((engagement: any) => mapEngagementRow(engagement)),
  }

  const notes: TimelineNote[] = fileNotes.map((note: any) => ({
    id: note.id,
    noteType: note.note_type ?? "internal",
    text: note.text,
    createdAt: note.created_at.toISOString(),
  }))

  return <ClientRecord client={client} notes={notes} />
}
