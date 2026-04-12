import ClientList from "@/components/clients/ClientList"
import { db } from "@/lib/db"
import type { ClientListItem } from "@/types/clients"

export default async function ClientsPage() {
  const parties = await db.party.findMany({
    where: { party_type: "person" },
    include: { person: true, client_classification: true },
    orderBy: { display_name: "asc" },
  })

  const clients: ClientListItem[] = parties.map((party) => {
    const givenName = party.person?.preferred_name || party.person?.legal_given_name || ""
    const familyName = party.person?.legal_family_name || ""
    const fullName = `${givenName} ${familyName}`.trim() || party.display_name
    return {
      id: party.id,
      fullName,
      partyType: party.party_type,
      status: party.status,
      updatedAt: party.updated_at.toISOString(),
      classification: party.client_classification
        ? {
            serviceTier: party.client_classification.service_tier,
            lifecycleStage: null,
          }
        : null,
    }
  })

  return <ClientList clients={clients} />
}
