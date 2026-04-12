"use client"

import Link from "next/link"
import { useState } from "react"

import type { ClientDetail } from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
}

type TimelineFilter = "all" | "emails" | "notes" | "docs"
type NoteCategory = "phone_call" | "meeting" | "internal" | "action_required" | "fyi"

type TimelineNote = {
  id: string
  category: NoteCategory
  body: string
  author: string
  timestamp: string
}

const timelineFilters: { label: string; value: TimelineFilter }[] = [
  { label: "All", value: "all" },
  { label: "Emails", value: "emails" },
  { label: "Notes", value: "notes" },
  { label: "Docs", value: "docs" },
]

const noteCategories: { label: string; value: NoteCategory }[] = [
  { label: "Phone Call", value: "phone_call" },
  { label: "Meeting", value: "meeting" },
  { label: "Internal", value: "internal" },
  { label: "Action Required", value: "action_required" },
  { label: "FYI", value: "fyi" },
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

function formatCategory(category: NoteCategory) {
  switch (category) {
    case "phone_call":
      return "Phone Call"
    case "meeting":
      return "Meeting"
    case "action_required":
      return "Action Required"
    case "fyi":
      return "FYI"
    default:
      return "Internal"
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

function NoteIcon() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FEF0E7] text-[#C45F1A]">
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M5 2.5h4l2 2v7A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-7A1.5 1.5 0 0 1 5.5 3H9m0-.5V5h2.5M6 8h4M6 10.5h3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default function ClientRecord({ client }: ClientRecordProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all")
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false)
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("internal")
  const [noteBody, setNoteBody] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [notes, setNotes] = useState<TimelineNote[]>([])

  const fullLegalName = client.person
    ? `${client.person.legalGivenName} ${client.person.legalFamilyName}`.trim()
    : null

  const timelineNotes = activeFilter === "emails" || activeFilter === "docs" ? [] : notes

  async function handleSaveNote() {
    if (!noteBody.trim()) {
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partyId: client.id,
          body: noteBody,
          category: noteCategory,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save note")
      }

      const createdNote = await response.json()

      setNotes((currentNotes) => [
        {
          id: createdNote.id,
          category: createdNote.note_type as NoteCategory,
          body: createdNote.text,
          author: "Andrew Rowan",
          timestamp: "Just now",
        },
        ...currentNotes,
      ])
      setNoteBody("")
      setNoteCategory("internal")
      setIsNotePanelOpen(false)
      setActiveFilter("notes")
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  function openNotePanel() {
    setIsNotePanelOpen(true)
    setActiveFilter("notes")
  }

  function handleCancelNote() {
    setNoteBody("")
    setNoteCategory("internal")
    setIsNotePanelOpen(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-start justify-between border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[14px]">
        <div className="space-y-2">
          <Link href="/clients" className="inline-flex text-[11px] text-[#9ca3af]">
            {"\u2190"} Clients
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
            onClick={openNotePanel}
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
                    className={`rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[9px] py-1 text-[11px] ${
                      isActive ? "bg-[#113238] text-white" : "bg-white text-[#113238]"
                    }`}
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
                onClick={openNotePanel}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[11px] text-white"
              >
                + Note
              </button>
            </div>
          </div>

          {isNotePanelOpen ? (
            <div className="mt-[14px] rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {noteCategories.map((category) => {
                  const isActive = category.value === noteCategory

                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setNoteCategory(category.value)}
                      className={`rounded-[999px] border-[0.5px] px-[10px] py-[4px] text-[11px] ${
                        isActive
                          ? "border-[#113238] bg-[#113238] text-white"
                          : "border-[#e5e7eb] bg-white text-[#113238]"
                      }`}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                className="mt-3 min-h-[80px] w-full resize-y rounded-[7px] border-[0.5px] border-[#e5e7eb] p-2 text-[12px] text-[#113238] outline-none"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[11px] text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelNote}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {timelineNotes.length > 0 ? (
            <div className="mt-[14px] space-y-3">
              {timelineNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white p-[14px]"
                >
                  <div className="flex gap-3">
                    <NoteIcon />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[12px] font-medium text-[#113238]">
                          {formatCategory(note.category)}
                        </p>
                        <p className="text-[11px] text-[#9ca3af]">{note.author}</p>
                        <p className="text-[11px] text-[#9ca3af]">{note.timestamp}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[12px] text-[#113238]">
                        {note.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-[13px] text-[#9ca3af]">No activity yet</p>
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Notes, emails and documents will appear here
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}