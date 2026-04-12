import { notFound } from "next/navigation"

import ClientRecord from "@/components/clients/ClientRecord"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
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

export default async function ClientRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [party, fileNotes, householdMembership] = await Promise.all([
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
  ])

  if (!party) {
    notFound()
  }

  const householdMembers = householdMembership
    ? await db.household_member.findMany({
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
      })
    : []

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
  }

  const notes: TimelineNote[] = fileNotes.map((note) => ({
    id: note.id,
    noteType: note.note_type ?? "internal",
    text: note.text,
    createdAt: note.created_at.toISOString(),
  }))

  return <ClientRecord client={client} notes={notes} />
}
