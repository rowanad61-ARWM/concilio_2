import ClientList from "@/components/clients/ClientList";
import { db } from "@/lib/db";

export type ClientListItem = {
  id: string;
  fullName: string;
  partyType: string;
  status: string;
  updatedAt: string;
};

export default async function ClientsPage() {
  const parties = await db.party.findMany({
    where: {
      party_type: "person",
    },
    include: {
      person: true,
    },
    orderBy: {
      display_name: "asc",
    },
  });

  const clients: ClientListItem[] = parties.map((party) => {
    const givenName = party.person?.preferred_name || party.person?.legal_given_name || "";
    const familyName = party.person?.legal_family_name || "";
    const fullName = `${givenName} ${familyName}`.trim() || party.display_name;

    return {
      id: party.id,
      fullName,
      partyType: party.party_type,
      status: party.status,
      updatedAt: party.updated_at.toISOString(),
    };
  });

  return <ClientList clients={clients} />;
}
