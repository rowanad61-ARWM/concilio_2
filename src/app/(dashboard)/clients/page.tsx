import ClientList from "@/components/clients/ClientList"
import { db } from "@/lib/db"
import type { ClientListItem } from "@/types/clients"

export default async function ClientsPage() {
  const parties = await db.party.findMany({
    where: { party_type: "person" },
    include: {
      person: true,
      client_classification: true,
      household_member: {
        where: {
          end_date: null,
        },
        include: {
          household_group: true,
        },
      },
    },
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
      householdName: party.household_member[0]?.household_group.household_name ?? null,
      classification: party.client_classification
        ? {
            serviceTier: party.client_classification.service_tier,
            lifecycleStage: party.client_classification.lifecycle_stage,
          }
        : null,
    }
  })

  const householdAwareTotalHouseholds = new Set<string>()
  const activeHouseholds = new Set<string>()
  const prospectHouseholds = new Set<string>()
  const prospectStages = new Set(["prospect", "engagement", "advising", "implementation"])

  let householdAwareTotalUngrouped = 0
  let activeUngrouped = 0
  let prospectUngrouped = 0

  for (const party of parties) {
    const householdId = party.household_member[0]?.household_id ?? null

    if (householdId) {
      householdAwareTotalHouseholds.add(householdId)
    } else {
      householdAwareTotalUngrouped += 1
    }

    if (party.status === "active") {
      if (householdId) {
        activeHouseholds.add(householdId)
      } else {
        activeUngrouped += 1
      }
    }

    if (prospectStages.has(party.client_classification?.lifecycle_stage ?? "")) {
      if (householdId) {
        prospectHouseholds.add(householdId)
      } else {
        prospectUngrouped += 1
      }
    }
  }

  const householdAwareTotal = householdAwareTotalHouseholds.size + householdAwareTotalUngrouped
  const householdAwareActive = activeHouseholds.size + activeUngrouped
  const prospectCount = prospectHouseholds.size + prospectUngrouped

  return (
    <ClientList
      clients={clients}
      prospectCount={prospectCount}
      householdAwareTotal={householdAwareTotal}
      householdAwareActive={householdAwareActive}
    />
  )
}
