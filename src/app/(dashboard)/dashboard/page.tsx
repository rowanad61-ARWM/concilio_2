import Dashboard from "@/components/dashboard/Dashboard"
import { db } from "@/lib/db"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [parties, workflowCount] = await Promise.all([
    db.party.findMany({
      where: {
        party_type: "person",
        archived_at: null,
      },
      select: {
        id: true,
        status: true,
        client_classification: {
          select: {
            lifecycle_stage: true,
          },
        },
        household_member: {
          where: {
            end_date: null,
          },
          select: {
            household_id: true,
          },
        },
      },
    }),
    db.workflow_instance.count({
      where: {
        status: "active",
      },
    }),
  ])

  const prospectCount = parties.filter((party: any) => {
    const stage = party.client_classification?.lifecycle_stage
    return (
      stage === "prospect" ||
      stage === "engagement" ||
      stage === "advice" ||
      stage === "implementation"
    )
  }).length

  const activeHouseholds = new Set<string>()
  let activeUngrouped = 0

  for (const party of parties) {
    if (party.status !== "active") {
      continue
    }

    const householdId = party.household_member[0]?.household_id ?? null
    if (householdId) {
      activeHouseholds.add(householdId)
    } else {
      activeUngrouped += 1
    }
  }

  const totalCount = parties.length
  const activeCount = activeHouseholds.size + activeUngrouped

  return (
    <Dashboard
      totalCount={totalCount}
      activeCount={activeCount}
      prospectCount={prospectCount}
      workflowCount={workflowCount}
    />
  )
}
