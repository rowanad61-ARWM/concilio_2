"use client"

import Link from "next/link"
import { useState } from "react"

import type { ClientDetail, TimelineNote } from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
  notes: TimelineNote[]
}

type TimelineFilter = "all" | "emails" | "notes" | "docs"
type NoteCategory = "general" | "meeting" | "phone_call" | "email" | "compliance" | "other"

type EditFormState = {
  firstName: string
  lastName: string
  preferredName: string
  dateOfBirth: string
  email: string
  mobile: string
  relationshipStatus: string
  countryOfResidence: string
}

const timelineFilters: { label: string; value: TimelineFilter }[] = [
  { label: "All", value: "all" },
  { label: "Emails", value: "emails" },
  { label: "Notes", value: "notes" },
  { label: "Docs", value: "docs" },
]

const noteCategories: { label: string; value: NoteCategory }[] = [
  { label: "General", value: "general" },
  { label: "Meeting", value: "meeting" },
  { label: "Phone Call", value: "phone_call" },
  { label: "Email", value: "email" },
  { label: "Compliance", value: "compliance" },
  { label: "Other", value: "other" },
]

const relationshipOptions = ["single", "married", "de_facto", "separated", "divorced", "widowed"]

const inputClassName =
  "w-full rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[8px] py-[6px] text-[12px] text-[#113238] outline-none"

function buildEditForm(client: ClientDetail): EditFormState {
  return {
    firstName: client.person?.legalGivenName ?? "",
    lastName: client.person?.legalFamilyName ?? "",
    preferredName: client.person?.preferredName ?? "",
    dateOfBirth: client.person?.dateOfBirth ? client.person.dateOfBirth.slice(0, 10) : "",
    email: client.person?.emailPrimary ?? "",
    mobile: client.person?.mobilePhone ?? "",
    relationshipStatus: client.person?.relationshipStatus ?? "",
    countryOfResidence: client.person?.countryOfResidence ?? "",
  }
}

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

function formatTimelineTimestamp(value: string) {
  if (value === "just-now") {
    return "Just now"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function formatCategory(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatClassificationValue(value: string) {
  if (value === "wealth_manager_plus") {
    return "Wealth Manager+"
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatHouseholdRole(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
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

function EditField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-[#9ca3af]">{label}</span>
      {children}
    </label>
  )
}

function NoteIcon() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#FEF0E7] text-[#C45F1A]">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
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

export default function ClientRecord({ client, notes }: ClientRecordProps) {
  const [clientData, setClientData] = useState(client)
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all")
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false)
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("general")
  const [noteBody, setNoteBody] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes)
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingChanges, setIsSavingChanges] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>(() => buildEditForm(client))
  const [isLinkingHousehold, setIsLinkingHousehold] = useState(false)
  const [householdNameInput, setHouseholdNameInput] = useState("")
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false)

  const fullLegalName = clientData.person
    ? `${clientData.person.legalGivenName} ${clientData.person.legalFamilyName}`.trim()
    : null

  const visibleNotes = activeFilter === "all" || activeFilter === "notes" ? localNotes : []
  const otherHouseholdMembers = clientData.household?.members.filter((member) => member.id !== clientData.id) ?? []

  function updateEditField<Key extends keyof EditFormState>(key: Key, value: EditFormState[Key]) {
    setEditForm((current) => ({ ...current, [key]: value }))
  }

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
          partyId: clientData.id,
          body: noteBody,
          category: noteCategory,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save note")
      }

      const createdNote = await response.json()

      setLocalNotes((currentNotes) => [
        {
          id: createdNote.id,
          noteType: createdNote.note_type,
          text: createdNote.text,
          createdAt: "just-now",
        },
        ...currentNotes,
      ])
      setNoteBody("")
      setNoteCategory("general")
      setIsNotePanelOpen(false)
      setActiveFilter("notes")
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveChanges() {
    setIsSavingChanges(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error("Failed to update client")
      }

      const updated = await response.json()

      const nextClientData: ClientDetail = {
        ...clientData,
        displayName: updated.displayName,
        person: clientData.person
          ? {
              ...clientData.person,
              legalGivenName: updated.person.legal_given_name,
              legalFamilyName: updated.person.legal_family_name,
              preferredName: updated.person.preferred_name,
              dateOfBirth: updated.person.date_of_birth,
              emailPrimary: updated.person.email_primary,
              mobilePhone: updated.person.mobile_phone,
              relationshipStatus: updated.person.relationship_status,
              countryOfResidence: updated.person.country_of_residence,
            }
          : {
              legalGivenName: updated.person.legal_given_name,
              legalFamilyName: updated.person.legal_family_name,
              preferredName: updated.person.preferred_name,
              dateOfBirth: updated.person.date_of_birth,
              mobilePhone: updated.person.mobile_phone,
              emailPrimary: updated.person.email_primary,
              relationshipStatus: updated.person.relationship_status,
              countryOfResidence: updated.person.country_of_residence,
              preferredContactMethod: null,
            },
      }

      setClientData(nextClientData)
      setEditForm(buildEditForm(nextClientData))
      setIsEditing(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingChanges(false)
    }
  }

  async function handleCreateHousehold() {
    if (!householdNameInput.trim()) {
      return
    }

    setIsCreatingHousehold(true)

    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          householdName: householdNameInput,
          memberIds: [clientData.id],
          primaryMemberId: clientData.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create household")
      }

      const result = await response.json()

      setClientData((current) => ({
        ...current,
        household: {
          id: result.id,
          name: householdNameInput,
          role: "primary",
          members: [
            {
              id: current.id,
              displayName: current.displayName,
              role: "primary",
            },
          ],
        },
      }))
      setHouseholdNameInput("")
      setIsLinkingHousehold(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsCreatingHousehold(false)
    }
  }

  function openNotePanel() {
    setIsNotePanelOpen(true)
    setActiveFilter("notes")
  }

  function handleCancelNote() {
    setNoteBody("")
    setNoteCategory("general")
    setIsNotePanelOpen(false)
  }

  function handleStartEditing() {
    setEditForm(buildEditForm(clientData))
    setIsEditing(true)
  }

  function handleCancelEditing() {
    setEditForm(buildEditForm(clientData))
    setIsEditing(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-start justify-between border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[14px]">
        <div className="space-y-2">
          <Link href="/clients" className="inline-flex text-[11px] text-[#9ca3af]">
            {"\u2190"} Clients
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold text-[#113238]">{clientData.displayName}</h1>
            <span
              className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(clientData.status)}`}
            >
              {clientData.status}
            </span>
          </div>
          <p className="text-[11px] text-[#6b7280]">Adviser: Andrew Rowan</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartEditing}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[11px] text-[#113238]"
          >
            Edit
          </button>
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
              {isEditing ? (
                <>
                  <EditField label="Email">
                    <input
                      value={editForm.email}
                      onChange={(event) => updateEditField("email", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Mobile">
                    <input
                      value={editForm.mobile}
                      onChange={(event) => updateEditField("mobile", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Date of birth">
                    <input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(event) => updateEditField("dateOfBirth", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <DetailField label="Email" value={clientData.person?.emailPrimary ?? null} />
                  <DetailField label="Mobile" value={clientData.person?.mobilePhone ?? null} />
                  <DetailField label="Date of birth" value={formatDate(clientData.person?.dateOfBirth ?? null)} />
                </>
              )}
              <DetailField
                label="Preferred contact method"
                value={clientData.person?.preferredContactMethod ?? null}
              />
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Household</h2>
            {clientData.household ? (
              <div className="space-y-3">
                <p className="text-[12px] font-medium text-[#113238]">{clientData.household.name}</p>
                <p className="text-[11px] text-[#9ca3af]">{formatHouseholdRole(clientData.household.role)}</p>
                {otherHouseholdMembers.length > 0 ? (
                  <div className="space-y-1">
                    {otherHouseholdMembers.map((member) => (
                      <Link
                        key={member.id}
                        href={`/clients/${member.id}`}
                        className="block text-[11px] text-[#113238] underline-offset-2 hover:underline"
                      >
                        {member.displayName}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-[#9ca3af]">No household</p>
                <button
                  type="button"
                  onClick={() => setIsLinkingHousehold((current) => !current)}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
                >
                  Link to household
                </button>
                {isLinkingHousehold ? (
                  <div className="space-y-2">
                    <input
                      value={householdNameInput}
                      onChange={(event) => setHouseholdNameInput(event.target.value)}
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      onClick={handleCreateHousehold}
                      disabled={isCreatingHousehold}
                      className="w-full rounded-[6px] bg-[#FF8C42] px-[8px] py-[6px] text-[10px] text-white disabled:opacity-60"
                    >
                      Create & link
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Personal</h2>
            <div className="space-y-3">
              {isEditing ? (
                <>
                  <EditField label="First name">
                    <input
                      value={editForm.firstName}
                      onChange={(event) => updateEditField("firstName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Last name">
                    <input
                      value={editForm.lastName}
                      onChange={(event) => updateEditField("lastName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Preferred name">
                    <input
                      value={editForm.preferredName}
                      onChange={(event) => updateEditField("preferredName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Relationship status">
                    <select
                      value={editForm.relationshipStatus}
                      onChange={(event) => updateEditField("relationshipStatus", event.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Select</option>
                      {relationshipOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatCategory(option)}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Country of residence">
                    <input
                      value={editForm.countryOfResidence}
                      onChange={(event) => updateEditField("countryOfResidence", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <DetailField label="Full legal name" value={fullLegalName} />
                  <DetailField label="Relationship status" value={clientData.person?.relationshipStatus ?? null} />
                  <DetailField label="Country of residence" value={clientData.person?.countryOfResidence ?? null} />
                </>
              )}
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Identity</h2>
            <p className="text-[11px] text-[#9ca3af]">No ID documents on file</p>
          </section>

          <section className="mt-6 space-y-4">
            <h2 className="text-[11px] font-medium text-[#113238]">Service</h2>
            {clientData.classification?.serviceTier ? (
              <DetailField
                label="Service tier"
                value={formatClassificationValue(clientData.classification.serviceTier)}
              />
            ) : clientData.classification?.lifecycleStage ? (
              <DetailField
                label="Lifecycle stage"
                value={formatClassificationValue(clientData.classification.lifecycleStage)}
              />
            ) : (
              <p className="text-[12px] text-[#113238]">Not classified</p>
            )}
          </section>

          {isEditing ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSavingChanges}
                className="w-full rounded-[7px] bg-[#FF8C42] px-4 py-[10px] text-[12px] text-white disabled:opacity-60"
              >
                {isSavingChanges ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="mt-[6px] w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-[10px] text-[12px] text-[#113238]"
              >
                Cancel
              </button>
            </div>
          ) : null}
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

          {visibleNotes.length > 0 ? (
            <div className="mt-[14px]">
              {visibleNotes.map((note) => (
                <div
                  key={note.id}
                  className="mb-2 rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-[10px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <NoteIcon />
                      <p className="text-[12px] font-medium text-[#113238]">
                        {formatCategory(note.noteType)}
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">Andrew Rowan</p>
                    </div>
                    <p className="shrink-0 text-right text-[11px] text-[#9ca3af]">
                      {formatTimelineTimestamp(note.createdAt)}
                    </p>
                  </div>
                  <p className="mt-[6px] text-[12px] leading-[1.6] text-[#374151]">{note.text}</p>
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