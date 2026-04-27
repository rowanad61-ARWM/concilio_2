import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

function formatDate(value: Date) {
  return value.toISOString()
}

function formatNullable(value: string | null | undefined) {
  return value ? value : "-"
}

export default async function AdminCalendlyEventTypesPage() {
  const eventTypes = await db.calendly_event_type_map.findMany({
    orderBy: [
      { active: "desc" },
      { meeting_type_key: "asc" },
      { display_name: "asc" },
    ],
  })

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Calendly Event Types</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {eventTypes.length} mappings
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Meeting type</th>
              <th className="px-4 py-3">Display name</th>
              <th className="px-4 py-3">Calendly URI</th>
              <th className="px-4 py-3">Auto prospect</th>
              <th className="px-4 py-3">Log level</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {eventTypes.length > 0 ? (
              eventTypes.map((eventType) => (
                <tr key={eventType.id} className="border-t border-[#edf1f4] align-top hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3 font-mono text-[12px] text-[#185F68]">
                    {eventType.meeting_type_key}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#113238]">{eventType.display_name}</td>
                  <td className="max-w-[420px] break-all px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {formatNullable(eventType.calendly_event_type_uri)}
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">{eventType.auto_create_prospect ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{eventType.unresolved_log_level}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-[999px] bg-[#EAF0F1] px-2 py-1 text-[11px] text-[#4b5563]">
                      {eventType.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4b5563]">{formatDate(eventType.updated_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#6b7280]">
                  No Calendly event type mappings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
