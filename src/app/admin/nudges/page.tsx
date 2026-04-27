import Link from "next/link"

import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

function formatNullable(value: string | null | undefined) {
  return value ? value : "-"
}

export default async function AdminNudgesPage() {
  const [nudges, templates] = await Promise.all([
    db.workflow_template_nudge.findMany({
      orderBy: [
        { workflow_template_key: "asc" },
        { decision_state_key: "asc" },
        { driver_action_key: "asc" },
        { nudge_sequence_index: "asc" },
      ],
    }),
    db.workflow_template.findMany({
      select: {
        key: true,
        name: true,
      },
    }),
  ])

  const templateNamesByKey = new Map(templates.map((template) => [template.key, template.name]))

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Nudges</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {nudges.length} nudges
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Decision state</th>
              <th className="px-4 py-3">Driver action</th>
              <th className="px-4 py-3">Sequence</th>
              <th className="px-4 py-3">Delay</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Email template</th>
              <th className="px-4 py-3">SMS template</th>
              <th className="px-4 py-3">Terminal</th>
            </tr>
          </thead>
          <tbody>
            {nudges.length > 0 ? (
              nudges.map((nudge) => (
                <tr key={nudge.id} className="border-t border-[#edf1f4] align-top hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/templates/${nudge.workflow_template_key}`}
                      className="font-medium text-[#113238] hover:underline"
                    >
                      {templateNamesByKey.get(nudge.workflow_template_key) ?? nudge.workflow_template_key}
                    </Link>
                    <p className="mt-1 font-mono text-[12px] text-[#6b7280]">
                      {nudge.workflow_template_key}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">{nudge.decision_state_key}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#185F68]">{nudge.driver_action_key}</td>
                  <td className="px-4 py-3 text-[#113238]">{nudge.nudge_sequence_index}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{nudge.delay_days} days</td>
                  <td className="px-4 py-3 text-[#4b5563]">{nudge.preferred_channel}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {nudge.email_template_key ? (
                      <Link href={`/admin/email-templates/${nudge.email_template_key}`} className="hover:underline">
                        {nudge.email_template_key}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {formatNullable(nudge.sms_template_key)}
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">
                    {nudge.terminal ? formatNullable(nudge.terminal_outcome_key) : "No"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#6b7280]">
                  No workflow nudges found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
