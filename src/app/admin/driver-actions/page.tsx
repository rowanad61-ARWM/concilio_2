import { getDriverActionsForAdmin } from "@/lib/adminAdapters"

export const dynamic = "force-dynamic"

export default function AdminDriverActionsPage() {
  const driverActions = getDriverActionsForAdmin()

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Driver Actions</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {driverActions.length} actions
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Eligible templates</th>
              <th className="px-4 py-3">Eligible states</th>
              <th className="px-4 py-3">Sends email</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {driverActions.length > 0 ? (
              driverActions.map((action) => (
                <tr key={action.key} className="border-t border-[#edf1f4] align-top hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#185F68]">{action.key}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {action.eligibleTemplates.map((templateKey) => (
                        <span
                          key={templateKey}
                          className="rounded-[999px] bg-[#EAF0F1] px-2 py-1 font-mono text-[11px] text-[#185F68]"
                        >
                          {templateKey}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-[300px] px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {action.eligibleStates.map((state) => (
                        <span
                          key={state}
                          className="rounded-[999px] bg-[#F3F4F6] px-2 py-1 font-mono text-[11px] text-[#4b5563]"
                        >
                          {state}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">
                    {action.sendsEmail ? action.emailTemplateKey : "No"}
                  </td>
                  <td className="max-w-[360px] px-4 py-3 text-[#4b5563]">{action.description}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#6b7280]">
                  No driver actions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
