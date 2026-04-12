import Dashboard from "@/components/dashboard/Dashboard"
import { db } from "@/lib/db"

export default async function DashboardPage() {
  const [totalCount, activeCount, workflowCount] = await Promise.all([
    db.party.count({
      where: {
        party_type: "person",
        archived_at: null,
      },
    }),
    db.party.count({
      where: {
        party_type: "person",
        status: "active",
        archived_at: null,
      },
    }),
    db.workflow_instance.count({
      where: {
        status: "active",
      },
    }),
  ])

  return (
    <Dashboard
      totalCount={totalCount}
      activeCount={activeCount}
      workflowCount={workflowCount}
    />
  )
}
