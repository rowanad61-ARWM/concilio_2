import ClientList from "@/components/clients/ClientList"
import { db } from "@/lib/db"
import type { HouseholdListItem } from "@/types/clients"

export const dynamic = 'force-dynamic'

type GroupMember = {
  id: string
  displayName: string
  role: string
  status: string
  updatedAt: string
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
}

function getDisplayName(party: {
  display_name: string
  person: {
    preferred_name: string | null
    legal_given_name: string
    legal_family_name: string
  } | null
}) {
  const givenName = party.person?.preferred_name || party.person?.legal_given_name || ""
  const familyName = party.person?.legal_family_name || ""
  return `${givenName} ${familyName}`.trim() || party.display_name
}

function sortMembersByRole(a: GroupMember, b: GroupMember) {
  const roleRankA = a.role === "primary" ? 0 : 1
  const roleRankB = b.role === "primary" ? 0 : 1

  if (roleRankA !== roleRankB) {
    return roleRankA - roleRankB
  }

  return a.displayName.localeCompare(b.displayName)
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const normalizedSearch = search?.trim() ?? ""

  const parties = await db.party.findMany({
    where: {
      party_type: "person",
      AND: normalizedSearch
        ? [
            {
              OR: [
                { display_name: { contains: normalizedSearch, mode: "insensitive" } },
                {
                  person: {
                    is: {
                      email_primary: { contains: normalizedSearch, mode: "insensitive" },
                    },
                  },
                },
                {
                  person: {
                    is: {
                      mobile_phone: { contains: normalizedSearch, mode: "insensitive" },
                    },
                  },
                },
                {
                  person: {
                    is: {
                      legal_given_name: { contains: normalizedSearch, mode: "insensitive" },
                    },
                  },
                },
                {
                  person: {
                    is: {
                      legal_family_name: { contains: normalizedSearch, mode: "insensitive" },
                    },
                  },
                },
              ],
            },
          ]
        : [],
    },
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

  const groupedHouseholds = new Map<
    string,
    {
      id: string
      displayName: string
      members: GroupMember[]
    }
  >()
  const ungroupedItems: HouseholdListItem[] = []

  for (const party of parties) {
    const displayName = getDisplayName(party)
    const classification = party.client_classification
      ? {
          serviceTier: party.client_classification.service_segment ?? party.client_classification.service_tier,
          lifecycleStage: party.client_classification.lifecycle_stage,
        }
      : null
    const membership = party.household_member[0]

    if (membership?.household_id) {
      const householdId = membership.household_id
      const existing = groupedHouseholds.get(householdId)

      if (existing) {
        existing.members.push({
          id: party.id,
          displayName,
          role: membership.role_in_household,
          status: party.status,
          updatedAt: party.updated_at.toISOString(),
          classification,
        })
      } else {
        groupedHouseholds.set(householdId, {
          id: householdId,
          displayName: membership.household_group.household_name || `${displayName} Household`,
          members: [
            {
              id: party.id,
              displayName,
              role: membership.role_in_household,
              status: party.status,
              updatedAt: party.updated_at.toISOString(),
              classification,
            },
          ],
        })
      }
    } else {
      ungroupedItems.push({
        id: party.id,
        displayName,
        isHousehold: false,
        members: [
          {
            id: party.id,
            displayName,
            role: "primary",
          },
        ],
        status: party.status,
        updatedAt: party.updated_at.toISOString(),
        classification,
        householdName: null,
      })
    }
  }

  const groupedItems: HouseholdListItem[] = Array.from(groupedHouseholds.values()).map((household: any) => {
    const sortedMembers = [...household.members].sort(sortMembersByRole)
    const primaryMember = sortedMembers[0]

    return {
      id: household.id,
      displayName: household.displayName,
      isHousehold: true,
      members: sortedMembers.map((member: any) => ({
        id: member.id,
        displayName: member.displayName,
        role: member.role,
      })),
      status: primaryMember.status,
      updatedAt: primaryMember.updatedAt,
      classification: primaryMember.classification,
      householdName: household.displayName,
    }
  })

  const householdItems = [...groupedItems, ...ungroupedItems].sort((a: any, b: any) =>
    a.displayName.localeCompare(b.displayName),
  )

  const prospectStages = new Set(["prospect", "engagement", "advice", "implementation"])
  const householdAwareTotal = householdItems.length
  const householdAwareActive = householdItems.filter((item: any) => item.status === "active").length
  const prospectCount = householdItems.filter((item: any) =>
    prospectStages.has(item.classification?.lifecycleStage ?? ""),
  ).length

  return (
    <ClientList
      householdItems={householdItems}
      prospectCount={prospectCount}
      householdAwareTotal={householdAwareTotal}
      householdAwareActive={householdAwareActive}
      contactCount={parties.length}
      search={normalizedSearch || null}
    />
  )
}
