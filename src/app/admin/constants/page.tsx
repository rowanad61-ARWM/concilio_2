import { getConstantsForAdmin } from "@/lib/adminAdapters"

export const dynamic = "force-dynamic"

export default function AdminConstantsPage() {
  const constants = getConstantsForAdmin()
  const constantsByCategory = new Map<string, typeof constants>()

  for (const constant of constants) {
    const categoryConstants = constantsByCategory.get(constant.category) ?? []
    categoryConstants.push(constant)
    constantsByCategory.set(constant.category, categoryConstants)
  }

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Constants</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {constants.length} constants
        </div>
      </div>

      <div className="space-y-4">
        {constantsByCategory.size > 0 ? (
          [...constantsByCategory.entries()].map(([category, categoryConstants]) => (
            <section key={category} className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
              <div className="border-b border-[#edf1f4] px-4 py-3">
                <h2 className="text-[14px] font-semibold text-[#113238]">{category}</h2>
              </div>
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryConstants.map((constant) => (
                    <tr key={`${constant.category}-${constant.name}`} className="border-t border-[#edf1f4] align-top">
                      <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#185F68]">
                        {constant.name}
                      </td>
                      <td className="max-w-[360px] break-words px-4 py-3 font-mono text-[12px] text-[#374151]">
                        {constant.value}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[#6b7280]">{constant.fileLine}</td>
                      <td className="max-w-[360px] px-4 py-3 text-[#4b5563]">{constant.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ) : (
          <section className="rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-8 text-center text-[13px] text-[#6b7280]">
            No constants found.
          </section>
        )}
      </div>
    </div>
  )
}
