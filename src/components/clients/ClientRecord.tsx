"use client"

import Link from "next/link"
import { useState } from "react"

import type { ClientAddress, ClientDetail, TimelineNote } from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
  notes: TimelineNote[]
}

type TimelineFilter = "all" | "emails" | "notes" | "docs"
type NoteCategory = "general" | "meeting" | "phone_call" | "email" | "compliance" | "other"
type LifecycleStage = "prospect" | "engagement" | "advising" | "implementation" | "lapsed"
type ServiceTier = "transaction" | "cashflow_manager" | "wealth_manager" | "wealth_manager_plus"
type VerificationResult = "pass" | "pending" | "fail"
type VerificationDocumentType = "passport" | "drivers_licence" | "medicare_card" | "birth_certificate" | "other"
type VerificationCheck = ClientDetail["verificationChecks"][number]

type EditFormState = {
  firstName: string
  lastName: string
  preferredName: string
  dateOfBirth: string
  email: string
  mobile: string
  relationshipStatus: string
  countryOfResidence: string
  addressLine1: string
  addressLine2: string
  addressSuburb: string
  addressState: string
  addressPostcode: string
  addressCountry: string
}

type AddIdFormState = {
  documentType: VerificationDocumentType
  documentReference: string
  expiryDate: string
  result: VerificationResult
  notes: string
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
const lifecycleStageOptions: { label: string; value: LifecycleStage }[] = [
  { label: "Prospect", value: "prospect" },
  { label: "Engagement", value: "engagement" },
  { label: "Advising", value: "advising" },
  { label: "Implementation", value: "implementation" },
  { label: "Lapsed", value: "lapsed" },
]
const serviceTierOptions: { label: string; value: ServiceTier | null }[] = [
  { label: "None", value: null },
  { label: "Transaction", value: "transaction" },
  { label: "Cashflow Manager", value: "cashflow_manager" },
  { label: "Wealth Manager", value: "wealth_manager" },
  { label: "Wealth Manager+", value: "wealth_manager_plus" },
]
const verificationDocumentTypeOptions: { label: string; value: VerificationDocumentType }[] = [
  { label: "Passport", value: "passport" },
  { label: "Driver's Licence", value: "drivers_licence" },
  { label: "Medicare Card", value: "medicare_card" },
  { label: "Birth Certificate", value: "birth_certificate" },
  { label: "Other", value: "other" },
]
const verificationResultOptions: { label: string; value: VerificationResult }[] = [
  { label: "Pass", value: "pass" },
  { label: "Pending", value: "pending" },
  { label: "Fail", value: "fail" },
]

const inputClassName =
  "w-full rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[8px] py-[6px] text-[13px] text-[#113238] outline-none"

function buildEditForm(client: ClientDetail): EditFormState {
  const residentialAddress = client.person?.addressResidential

  return {
    firstName: client.person?.legalGivenName ?? "",
    lastName: client.person?.legalFamilyName ?? "",
    preferredName: client.person?.preferredName ?? "",
    dateOfBirth: client.person?.dateOfBirth ? client.person.dateOfBirth.slice(0, 10) : "",
    email: client.person?.emailPrimary ?? "",
    mobile: client.person?.mobilePhone ?? "",
    relationshipStatus: client.person?.relationshipStatus ?? "",
    countryOfResidence: client.person?.countryOfResidence ?? "",
    addressLine1: residentialAddress?.line1 ?? "",
    addressLine2: residentialAddress?.line2 ?? "",
    addressSuburb: residentialAddress?.suburb ?? "",
    addressState: residentialAddress?.state ?? "",
    addressPostcode: residentialAddress?.postcode ?? "",
    addressCountry: residentialAddress?.country ?? "AU",
  }
}

function mapAddress(value: unknown): ClientAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const address = value as Record<string, unknown>
  return {
    line1: typeof address.line1 === "string" ? address.line1 : null,
    line2: typeof address.line2 === "string" ? address.line2 : null,
    suburb: typeof address.suburb === "string" ? address.suburb : null,
    state: typeof address.state === "string" ? address.state : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
    country: typeof address.country === "string" ? address.country : null,
  }
}

function buildAddIdForm(): AddIdFormState {
  return {
    documentType: "passport",
    documentReference: "",
    expiryDate: "",
    result: "pending",
    notes: "",
  }
}

function formatAddressLines(address: ClientAddress | null): string[] {
  if (!address) {
    return []
  }

  const line1 = address.line1?.trim() ?? ""
  const line2 = address.line2?.trim() ?? ""
  const suburb = address.suburb?.trim() ?? ""
  const state = address.state?.trim() ?? ""
  const postcode = address.postcode?.trim() ?? ""
  const country = address.country?.trim().toUpperCase() ?? ""

  const lines: string[] = []
  if (line1) {
    lines.push(line1)
  }
  if (line2) {
    lines.push(line2)
  }

  const suburbStatePostcode = [suburb, state, postcode].filter(Boolean).join(" ")
  if (suburbStatePostcode) {
    lines.push(suburbStatePostcode)
  }

  if (country && country !== "AU") {
    lines.push(country)
  }

  return lines
}

function addressesEqual(first: ClientAddress | null, second: ClientAddress | null) {
  if (!first || !second) {
    return false
  }

  return (
    (first.line1 ?? "") === (second.line1 ?? "") &&
    (first.line2 ?? "") === (second.line2 ?? "") &&
    (first.suburb ?? "") === (second.suburb ?? "") &&
    (first.state ?? "") === (second.state ?? "") &&
    (first.postcode ?? "") === (second.postcode ?? "") &&
    ((first.country ?? "AU").toUpperCase() === (second.country ?? "AU").toUpperCase())
  )
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

function formatVerificationResult(value: string): VerificationResult {
  const normalized = value.toLowerCase()

  if (normalized === "pass" || normalized === "verified") {
    return "pass"
  }

  if (normalized === "fail" || normalized === "failed" || normalized === "expired") {
    return "fail"
  }

  return "pending"
}

function getVerificationResultBadgeClasses(result: VerificationResult) {
  switch (result) {
    case "pass":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    case "fail":
      return "bg-[#FCE8E8] text-[#E24B4A]"
    default:
      return "bg-[#F3F4F6] text-[#6B7280]"
  }
}

function formatDocumentType(value: string | null) {
  if (!value) {
    return "ID Document"
  }

  const normalized = value.toLowerCase()
  switch (normalized) {
    case "passport":
      return "Passport"
    case "drivers_licence":
      return "Driver's Licence"
    case "medicare_card":
      return "Medicare Card"
    case "birth_certificate":
      return "Birth Certificate"
    case "other":
      return "Other"
    default:
      return formatCategory(value)
  }
}

function getExpiryState(value: string | null) {
  if (!value) {
    return "none"
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return "none"
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiryDate = new Date(parsedDate)
  expiryDate.setHours(0, 0, 0, 0)

  if (expiryDate < today) {
    return "expired"
  }

  const sixtyDaysFromNow = new Date(today)
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

  if (expiryDate <= sixtyDaysFromNow) {
    return "dueSoon"
  }

  return "active"
}

function getExpiryTextClass(expiryState: string) {
  switch (expiryState) {
    case "expired":
      return "text-[#E24B4A]"
    case "dueSoon":
      return "text-[#FF8C42]"
    default:
      return "text-[#113238]"
  }
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

function getClassificationClasses(value: string) {
  switch (value) {
    case "wealth_manager_plus":
      return "bg-[#FEF0E7] text-[#C45F1A]"
    case "wealth_manager":
      return "bg-[#EAF0F1] text-[#113238]"
    case "cashflow_manager":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    case "transaction":
      return "bg-[#E6F1FB] text-[#185FA5]"
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
    <div>
      <p className="mb-[2px] text-[10px] text-[#9ca3af]">{label}</p>
      <p className="text-[13px] leading-[1.5] text-[#113238]">
        {value && value.trim() ? value : "Not provided"}
      </p>
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
      <span className="mb-[2px] block text-[10px] text-[#9ca3af]">{label}</span>
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
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>(client.verificationChecks)
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
  const [isLifecycleMenuOpen, setIsLifecycleMenuOpen] = useState(false)
  const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false)
  const [isServiceTierMenuOpen, setIsServiceTierMenuOpen] = useState(false)
  const [isUpdatingServiceTier, setIsUpdatingServiceTier] = useState(false)
  const [isAddIdFormOpen, setIsAddIdFormOpen] = useState(false)
  const [isSavingIdVerification, setIsSavingIdVerification] = useState(false)
  const [addIdForm, setAddIdForm] = useState<AddIdFormState>(() => buildAddIdForm())

  const fullLegalName = clientData.person
    ? `${clientData.person.legalGivenName} ${clientData.person.legalFamilyName}`.trim()
    : null

  const visibleNotes = activeFilter === "all" || activeFilter === "notes" ? localNotes : []
  const otherHouseholdMembers = clientData.household?.members.filter((member) => member.id !== clientData.id) ?? []
  const lifecycleStage = clientData.classification?.lifecycleStage ?? null
  const serviceTier = clientData.classification?.serviceTier ?? null
  const residentialAddress = clientData.person?.addressResidential ?? null
  const postalAddress = clientData.person?.addressPostal ?? null
  const residentialAddressLines = formatAddressLines(residentialAddress)
  const postalAddressLines = formatAddressLines(postalAddress)
  const showPostalAddress = postalAddressLines.length > 0 && !addressesEqual(residentialAddress, postalAddress)

  function updateEditField<Key extends keyof EditFormState>(key: Key, value: EditFormState[Key]) {
    setEditForm((current) => ({ ...current, [key]: value }))
  }

  function updateAddIdField<Key extends keyof AddIdFormState>(key: Key, value: AddIdFormState[Key]) {
    setAddIdForm((current) => ({ ...current, [key]: value }))
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
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          preferredName: editForm.preferredName,
          dateOfBirth: editForm.dateOfBirth,
          email: editForm.email,
          mobile: editForm.mobile,
          relationshipStatus: editForm.relationshipStatus,
          countryOfResidence: editForm.countryOfResidence,
          addressResidential: {
            line1: editForm.addressLine1 || null,
            line2: editForm.addressLine2 || null,
            suburb: editForm.addressSuburb || null,
            state: editForm.addressState || null,
            postcode: editForm.addressPostcode || null,
            country: editForm.addressCountry || null,
          },
        }),
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
              addressResidential: mapAddress(updated.person.address_residential),
              addressPostal: mapAddress(updated.person.address_postal),
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
              addressResidential: mapAddress(updated.person.address_residential),
              addressPostal: mapAddress(updated.person.address_postal),
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

  async function handleLifecycleStageChange(nextStage: LifecycleStage) {
    setIsUpdatingLifecycle(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/classification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lifecycleStage: nextStage }),
      })

      if (!response.ok) {
        throw new Error("Failed to update lifecycle stage")
      }

      const updated = await response.json()

      setClientData((current) => ({
        ...current,
        classification: {
          serviceTier: updated.service_tier ?? current.classification?.serviceTier ?? null,
          lifecycleStage: updated.lifecycle_stage ?? null,
        },
      }))
      setIsLifecycleMenuOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUpdatingLifecycle(false)
    }
  }

  async function handleServiceTierChange(nextTier: ServiceTier | null) {
    setIsUpdatingServiceTier(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/classification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceTier: nextTier }),
      })

      if (!response.ok) {
        throw new Error("Failed to update service tier")
      }

      const updated = await response.json()

      setClientData((current) => ({
        ...current,
        classification: {
          serviceTier: updated.service_tier ?? null,
          lifecycleStage: updated.lifecycle_stage ?? current.classification?.lifecycleStage ?? null,
        },
      }))
      setIsServiceTierMenuOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUpdatingServiceTier(false)
    }
  }

  async function handleCopyAddressFromMember(memberId: string) {
    try {
      const response = await fetch(`/api/clients/${memberId}/address`)

      if (!response.ok) {
        throw new Error("Failed to fetch household member address")
      }

      const result = await response.json()
      const copiedAddress = mapAddress(result.addressResidential)

      setEditForm((current) => ({
        ...current,
        addressLine1: copiedAddress?.line1 ?? "",
        addressLine2: copiedAddress?.line2 ?? "",
        addressSuburb: copiedAddress?.suburb ?? "",
        addressState: copiedAddress?.state ?? "",
        addressPostcode: copiedAddress?.postcode ?? "",
        addressCountry: copiedAddress?.country ?? "",
      }))
    } catch (error) {
      console.error(error)
    }
  }

  async function handleSaveVerificationCheck() {
    setIsSavingIdVerification(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: addIdForm.documentType,
          documentReference: addIdForm.documentReference,
          expiryDate: addIdForm.expiryDate,
          result: addIdForm.result,
          notes: addIdForm.notes,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create verification check")
      }

      const created = await response.json()
      const createdCheck: VerificationCheck = {
        id: created.id,
        checkType: created.check_type,
        documentType: created.identity_document_type,
        documentReference: created.document_reference,
        result: formatVerificationResult(created.result),
        verifiedAt: created.verified_at,
        expiryDate: created.expiry_date,
        notes: created.notes,
      }

      setVerificationChecks((current) => [createdCheck, ...current])
      setAddIdForm(buildAddIdForm())
      setIsAddIdFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingIdVerification(false)
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

  function handleOpenAddIdForm() {
    setIsAddIdFormOpen(true)
  }

  function handleCancelAddIdForm() {
    setAddIdForm(buildAddIdForm())
    setIsAddIdFormOpen(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-start justify-between border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[14px]">
        <div className="space-y-2">
          <Link href="/clients" className="inline-flex text-[12px] text-[#9ca3af]">
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
          <p className="text-[12px] text-[#6b7280]">Adviser: Andrew Rowan</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartEditing}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
          >
            Email
          </button>
          <button
            type="button"
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
          >
            SMS
          </button>
          <button
            type="button"
            onClick={openNotePanel}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white"
          >
            + Note
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="min-h-full w-[250px] overflow-y-auto border-r-[0.5px] border-[#e5e7eb] bg-white p-4">
          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Contact</h2>
            <div className="space-y-[10px]">
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

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Address</h2>
            {isEditing && otherHouseholdMembers.length > 0 ? (
              <div className="mb-[10px] space-y-1">
                {otherHouseholdMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => void handleCopyAddressFromMember(member.id)}
                    className="block cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] text-[#FF8C42] hover:underline"
                  >
                    Same address as {member.displayName}
                  </button>
                ))}
              </div>
            ) : null}
            {isEditing ? (
              <div className="space-y-[10px]">
                <EditField label="Line 1">
                  <input
                    value={editForm.addressLine1}
                    onChange={(event) => updateEditField("addressLine1", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <EditField label="Line 2 (optional)">
                  <input
                    value={editForm.addressLine2}
                    onChange={(event) => updateEditField("addressLine2", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Suburb">
                    <input
                      value={editForm.addressSuburb}
                      onChange={(event) => updateEditField("addressSuburb", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="State">
                    <input
                      value={editForm.addressState}
                      onChange={(event) => updateEditField("addressState", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </div>
                <EditField label="Postcode">
                  <input
                    value={editForm.addressPostcode}
                    onChange={(event) => updateEditField("addressPostcode", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <EditField label="Country">
                  <input
                    value={editForm.addressCountry}
                    onChange={(event) => updateEditField("addressCountry", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
              </div>
            ) : residentialAddressLines.length > 0 ? (
              <div className="space-y-[10px]">
                <div className="space-y-1">
                  {residentialAddressLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-[13px] leading-[1.6] text-[#113238]">
                      {line}
                    </p>
                  ))}
                </div>

                {showPostalAddress ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#9ca3af]">Postal</p>
                    {postalAddressLines.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-[13px] leading-[1.6] text-[#113238]">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-[#9ca3af]">No address on file</p>
            )}
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Household</h2>
            {clientData.household ? (
              <div className="space-y-[10px]">
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
              <div className="space-y-[10px]">
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

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Personal</h2>
            <div className="space-y-[10px]">
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

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <div className="mb-[10px] flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Identity</h2>
              <button
                type="button"
                onClick={handleOpenAddIdForm}
                className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
              >
                + Add ID
              </button>
            </div>

            {isAddIdFormOpen ? (
              <div className="mb-3 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                <EditField label="Document type">
                  <select
                    value={addIdForm.documentType}
                    onChange={(event) => updateAddIdField("documentType", event.target.value as VerificationDocumentType)}
                    className={inputClassName}
                  >
                    {verificationDocumentTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Document reference">
                  <input
                    value={addIdForm.documentReference}
                    onChange={(event) => updateAddIdField("documentReference", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Expiry date">
                  <input
                    type="date"
                    value={addIdForm.expiryDate}
                    onChange={(event) => updateAddIdField("expiryDate", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Result">
                  <select
                    value={addIdForm.result}
                    onChange={(event) => updateAddIdField("result", event.target.value as VerificationResult)}
                    className={inputClassName}
                  >
                    {verificationResultOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Notes (optional)">
                  <textarea
                    value={addIdForm.notes}
                    onChange={(event) => updateAddIdField("notes", event.target.value)}
                    className={`${inputClassName} min-h-[70px] resize-y`}
                  />
                </EditField>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveVerificationCheck}
                    disabled={isSavingIdVerification}
                    className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                  >
                    {isSavingIdVerification ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddIdForm}
                    className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {verificationChecks.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af]">No ID documents on file</p>
            ) : (
              <div className="space-y-2">
                {verificationChecks.map((check) => {
                  const result = formatVerificationResult(check.result)
                  const expiryState = getExpiryState(check.expiryDate)

                  return (
                    <div key={check.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-[10px]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-[#113238]">{formatDocumentType(check.documentType)}</p>
                        <span
                          className={`inline-flex rounded-[999px] px-[8px] py-[2px] text-[10px] uppercase ${getVerificationResultBadgeClasses(result)}`}
                        >
                          {result}
                        </span>
                      </div>

                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {check.documentReference?.trim()
                          ? `Reference: ${check.documentReference}`
                          : "Reference not provided"}
                      </p>

                      {check.expiryDate ? (
                        <p className={`mt-1 text-[12px] ${getExpiryTextClass(expiryState)}`}>
                          Expires {formatDate(check.expiryDate)}
                        </p>
                      ) : null}

                      <p className="mt-1 text-[11px] text-[#9ca3af]">verified {formatDate(check.verifiedAt)}</p>

                      {check.notes ? <p className="mt-1 text-[11px] text-[#6b7280]">{check.notes}</p> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Service</h2>
            <div className="space-y-[10px]">
              <div className="relative space-y-[6px]">
              <p className="text-[11px] text-[#9ca3af]">Lifecycle stage</p>
              <button
                type="button"
                onClick={() => {
                  setIsLifecycleMenuOpen((current) => !current)
                  setIsServiceTierMenuOpen(false)
                }}
                className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[6px] text-[12px] text-[#113238]"
              >
                {lifecycleStage ? formatClassificationValue(lifecycleStage) : "Not set"}
              </button>

              {isLifecycleMenuOpen ? (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                  {lifecycleStageOptions.map((option) => {
                    const isSelected = option.value === lifecycleStage

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleLifecycleStageChange(option.value)}
                        disabled={isUpdatingLifecycle}
                        className={`block w-full cursor-pointer px-3 py-2 text-left text-[12px] ${
                          isSelected
                            ? "bg-[#113238] text-white"
                            : "text-[#113238] hover:bg-[#F5F7FA]"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              </div>
              <div className="relative space-y-[6px]">
                <p className="text-[11px] text-[#9ca3af]">Service tier</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceTierMenuOpen((current) => !current)
                    setIsLifecycleMenuOpen(false)
                  }}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[6px] text-left"
                >
                  {serviceTier ? (
                    <span
                      className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getClassificationClasses(serviceTier)}`}
                    >
                      {formatClassificationValue(serviceTier)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#9ca3af]">Not set</span>
                  )}
                </button>

                {isServiceTierMenuOpen ? (
                  <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                    {serviceTierOptions.map((option) => {
                      const isSelected = option.value === serviceTier

                      return (
                        <button
                          key={option.value ?? "none"}
                          type="button"
                          onClick={() => void handleServiceTierChange(option.value)}
                          disabled={isUpdatingServiceTier}
                          className={`block w-full cursor-pointer px-3 py-2 text-left text-[12px] ${
                            isSelected
                              ? "bg-[#113238] text-white"
                              : "text-[#113238] hover:bg-[#F5F7FA]"
                          }`}
                        >
                          {option.value ? (
                            <span
                              className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${
                                isSelected ? "bg-[#113238] text-white" : getClassificationClasses(option.value)
                              }`}
                            >
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
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
                    className={`rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[9px] py-1 text-[12px] ${
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
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
              >
                Email
              </button>
              <button
                type="button"
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
              >
                SMS
              </button>
              <button
                type="button"
                onClick={openNotePanel}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white"
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
                      className={`rounded-[999px] border-[0.5px] px-[10px] py-[4px] text-[12px] ${
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
                className="mt-3 min-h-[80px] w-full resize-y rounded-[7px] border-[0.5px] border-[#e5e7eb] p-2 text-[13px] text-[#113238] outline-none"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelNote}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
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
                      <p className="text-[13px] font-medium text-[#113238]">
                        {formatCategory(note.noteType)}
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">Andrew Rowan</p>
                    </div>
                    <p className="shrink-0 text-right text-[12px] text-[#9ca3af]">
                      {formatTimelineTimestamp(note.createdAt)}
                    </p>
                  </div>
                  <p className="mt-[6px] text-[13px] leading-[1.6] text-[#374151]">{note.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-[14px] text-[#9ca3af]">No activity yet</p>
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
