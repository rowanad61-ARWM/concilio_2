"use client"

import Link from "next/link"
import { useState } from "react"

import type { ClientDetail } from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
}

type TimelineFilter = "all" | "emails" | "notes" | "docs"

const timelineFilters: { label: string; value: TimelineFilter }[] = [
  { label: "All", value: "all" },
  { label: "Emails", value: "emails" },
  { label: "Notes", value: "notes" },
  { label: "Docs", value: "docs" },
]

function formatDate(value: string | null) {
  if (!value) {
    return "Not provided"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    default:
      return "bg-[#F3F4F6] text-[#6B7280]"
  }
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-[#9ca3af]">{label}</p>
      <p className="text-[12px] text-[#113238]">{value && value.trim() ? value : "Not provided"}</p>
    </div>
  )
}

export default function ClientRecord({ client }: ClientRecordProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all")

  const fullLegalName = client.person
    ? `${client.person.legalGivenName} ${client.person.legalFamilyName}`.trim()
    : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-start justify-between border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[14px]">
        <div className="space-y-2">
          <Link href="/clients" className="inline-flex text-[11px] text-[#9ca3af]">
            ← Clients
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold text-[#113238]">{client.displayName}</h1>
            <span
              className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(client.status)}`}
            >
              {client.status}
            </span>
          </div>
          <p className="text-[11px] text-[#6b7280]">Adviser: Andrew Rowan</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
          >
            Email
          </button>
          <button
            type="button"
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
          >
            SMS
          </button>
          <button
            type="button"
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[11px] text-white"
          >
            + Note
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[230px] overflow-y-auto border-r-[0.5px] border-[#e5e7eb] bg-white p-[14px]">
          <section className="space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Contact</h2>
            <div className="space-y-3">
              <DetailField label="Email" value={client.person?.emailPrimary ?? null} />
              <DetailField label="Mobile" value={client.person?.mobilePhone ?? null} />
              <DetailField label="Date of birth" value={formatDate(client.person?.dateOfBirth ?? null)} />
              <DetailField
                label="Preferred contact method"
                value={client.person?.preferredContactMethod ?? null}
              />
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Personal</h2>
            <div className="space-y-3">
              <DetailField label="Full legal name" value={fullLegalName} />
              <DetailField label="Relationship status" value={client.person?.relationshipStatus ?? null} />
              <DetailField label="Country of residence" value={client.person?.countryOfResidence ?? null} />
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Identity</h2>
            <p className="text-[11px] text-[#9ca3af]">No ID documents on file</p>
          </section>
        </aside>

        <section className="flex flex-1 flex-col overflow-y-auto bg-[#F7F9FB] px-[18px] py-[14px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {timelineFilters.map((filter) => {
                const isActive = filter.value === activeFilter

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={`rounded-[6px] px-[9px] py-1 text-[11px] ${
                      isActive ? "bg-[#113238] text-white" : "bg-white text-[#113238]"
                    } border-[0.5px] border-[#e5e7eb]`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
              >
                Email
              </button>
              <button
                type="button"
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
              >
                SMS
              </button>
              <button
                type="button"
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[11px] text-white"
              >
                + Note
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-[13px] text-[#9ca3af]">No activity yet</p>
              <p className="mt-1 text-[11px] text-[#9ca3af]">
                Notes, emails and documents will appear here
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
