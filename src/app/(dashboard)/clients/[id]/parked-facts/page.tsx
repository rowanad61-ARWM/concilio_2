import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/lib/db"

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

function formatCategory(value: string) {
  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

export default async function ParkedFactsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [party, parkedFacts] = await Promise.all([
    db.party.findUnique({
      where: { id },
      select: {
        id: true,
        display_name: true,
      },
    }),
    db.parked_fact.findMany({
      where: {
        party_id: id,
        status: "parked",
      },
      orderBy: [{ parked_at: "desc" }, { created_at: "desc" }],
      select: {
        id: true,
        category: true,
        summary: true,
        parked_at: true,
        notes: true,
        source_file_note_id: true,
      },
    }),
  ])

  if (!party) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-6 py-6">
      <div className="rounded-[12px] border-[0.5px] border-[#dbe3e8] bg-white px-5 py-4">
        <Link href={`/clients/${party.id}`} className="text-[12px] font-medium text-[#6b7280] underline-offset-2 hover:underline">
          Back to client record
        </Link>
        <div className="mt-3 flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[0px] text-[#113238]">Parked facts</h1>
          <p className="text-[13px] text-[#6b7280]">{party.display_name}</p>
        </div>
      </div>

      {parkedFacts.length === 0 ? (
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-5 py-4">
          <p className="text-[13px] text-[#6b7280]">No parked facts are waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parkedFacts.map((fact) => (
            <article key={fact.id} className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border-[0.5px] border-[#dbe3e8] bg-[#fbfcfd] px-2 py-1 text-[11px] text-[#6b7280]">
                      {formatCategory(fact.category)}
                    </span>
                    <span className="text-[12px] text-[#9ca3af]">{formatDateTime(fact.parked_at)}</span>
                  </div>
                  <p className="text-[14px] font-medium text-[#113238]">{fact.summary}</p>
                  {fact.notes ? <p className="text-[13px] leading-[1.5] text-[#6b7280]">{fact.notes}</p> : null}
                </div>
                {fact.source_file_note_id ? (
                  <Link
                    href={`/clients/${party.id}/file-notes/${fact.source_file_note_id}/review`}
                    className="shrink-0 rounded-[7px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[12px] font-medium text-[#113238] hover:bg-[#f7fafb]"
                  >
                    Source note
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
