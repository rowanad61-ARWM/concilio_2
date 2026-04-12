import { notFound } from "next/navigation"

import ClientRecord from "@/components/clients/ClientRecord"
import { db } from "@/lib/db"
import type { ClientDetail } from "@/types/client-record"

export default async function ClientRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const party = await db.party.findUnique({
    where: { id },
    include: {
      person: true,
      contact_method: true,
    },
  })

  if (!party) {
    notFound()
  }

  const client: ClientDetail = {
    id: party.id,
    displayName: party.display_name,
    partyType: party.party_type,
    status: party.status,
    updatedAt: party.updated_at.toISOString(),
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
        }
      : null,
    contactMethods: party.contact_method.map((contactMethod) => ({
      id: contactMethod.id,
      channel: contactMethod.channel,
      value: contactMethod.value,
      isPrimary: contactMethod.preferred_flag ?? false,
    })),
  }

  return <ClientRecord client={client} />
}
