import Link from "next/link"

import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

type TemplateRow = {
  id: string
  key: string
  name: string
  phase_order: number | null
  status: string
}

function formatPhaseOrder(phaseOrder: number | null) {
  return phaseOrder === null ? "Off-chain" : String(phaseOrder)
}

function sortTemplates(a: TemplateRow, b: TemplateRow) {
  const phaseA = a.phase_order ?? Number.MAX_SAFE_INTEGER
  const phaseB = b.phase_order ?? Number.MAX_SAFE_INTEGER

  if (phaseA !== phaseB) {
    return phaseA - phaseB
  }

  return a.key.localeCompare(b.key)
}

export default async function AdminTemplatesPage() {
  const [templates, taskTemplates, nudgeGroups] = await Promise.all([
    db.workflow_template.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        phase_order: true,
        status: true,
      },
    }),
    db.workflow_task_template.findMany({
      select: {
        workflow_template_id: true,
        _count: {
          select: {
            workflow_task_template_outcome: true,
          },
        },
      },
    }),
    db.workflow_template_nudge.groupBy({
      by: ["workflow_template_key"],
      _count: {
        _all: true,
      },
    }),
  ])

  const outcomeCountsByTemplateId = new Map<string, number>()
  for (const taskTemplate of taskTemplates) {
    const current = outcomeCountsByTemplateId.get(taskTemplate.workflow_template_id) ?? 0
    outcomeCountsByTemplateId.set(
      taskTemplate.workflow_template_id,
      current + taskTemplate._count.workflow_task_template_outcome,
    )
  }

  const nudgeCountsByTemplateKey = new Map(
    nudgeGroups.map((group) => [group.workflow_template_key, group._count._all]),
  )

  const sortedTemplates = [...templates].sort(sortTemplates)

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Workflow Templates</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {sortedTemplates.length} templates
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3 text-right">Outcomes</th>
              <th className="px-4 py-3 text-right">Nudges</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedTemplates.map((template) => (
              <tr key={template.id} className="border-t border-[#edf1f4] hover:bg-[#FAFBFC]">
                <td className="px-4 py-3 font-mono text-[12px] text-[#185F68]">
                  <Link href={`/admin/templates/${template.key}`} className="hover:underline">
                    {template.key}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-[#113238]">
                  <Link href={`/admin/templates/${template.key}`} className="hover:underline">
                    {template.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#4b5563]">{formatPhaseOrder(template.phase_order)}</td>
                <td className="px-4 py-3 text-right text-[#113238]">
                  {outcomeCountsByTemplateId.get(template.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-[#113238]">
                  {nudgeCountsByTemplateKey.get(template.key) ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-[999px] bg-[#EAF0F1] px-2 py-1 text-[11px] text-[#4b5563]">
                    {template.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
