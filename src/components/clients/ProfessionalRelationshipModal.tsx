"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ProfessionalRelationship } from "@/types/client-record"

type ProfessionalRelationshipModalProps = {
  clientId: string
  mode: "create" | "edit"
  relationship?: ProfessionalRelationship | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type ProfessionalRelationshipFormState = {
  relationshipType: string
  isAuthorised: boolean
  authorisationExpiry: string
  firstName: string
  surname: string
  company: string
  phone: string
  email: string
  addressLine: string
  addressSuburb: string
  addressState: string
  addressPostcode: string
  notes: string
}

const relationshipTypeOptions = [
  { label: "Doctor", value: "doctor" },
  { label: "Solicitor", value: "solicitor" },
  { label: "Accountant", value: "accountant" },
  { label: "Banker", value: "banker" },
  { label: "Mortgage broker", value: "mortgage_broker" },
  { label: "Other adviser", value: "other_adviser" },
  { label: "Other professional", value: "other_professional" },
] as const

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"
const textareaClassName = `${inputClassName} min-h-[110px] resize-y`

function value(value: string | null | undefined) {
  return value ?? ""
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ""
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildForm(relationship?: ProfessionalRelationship | null): ProfessionalRelationshipFormState {
  return {
    relationshipType: relationship?.relationshipType ?? "",
    isAuthorised: relationship?.isAuthorised ?? false,
    authorisationExpiry: dateInput(relationship?.authorisationExpiry),
    firstName: value(relationship?.firstName),
    surname: value(relationship?.surname),
    company: value(relationship?.company),
    phone: value(relationship?.phone),
    email: value(relationship?.email),
    addressLine: value(relationship?.addressLine),
    addressSuburb: value(relationship?.addressSuburb),
    addressState: value(relationship?.addressState),
    addressPostcode: value(relationship?.addressPostcode),
    notes: value(relationship?.notes),
  }
}

function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
      {children}
      {error ? <p className="text-[11px] text-[#B42318]">{error}</p> : null}
    </label>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">{children}</h3>
}

export default function ProfessionalRelationshipModal({
  clientId,
  mode,
  relationship,
  isOpen,
  onClose,
  onSaved,
}: ProfessionalRelationshipModalProps) {
  const [form, setForm] = useState<ProfessionalRelationshipFormState>(() => buildForm(relationship))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(mode === "edit" ? relationship : null))
    setFieldErrors({})
    setServerError(null)
  }, [isOpen, mode, relationship])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) {
    return null
  }

  function updateField<Key extends keyof ProfessionalRelationshipFormState>(
    key: Key,
    nextValue: ProfessionalRelationshipFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    if (!form.relationshipType) {
      nextErrors.relationshipType = "Type is required."
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    setServerError(null)

    try {
      const payload = {
        relationship_type: form.relationshipType,
        is_authorised: form.isAuthorised,
        authorisation_expiry: form.isAuthorised ? nullable(form.authorisationExpiry) : null,
        first_name: nullable(form.firstName),
        surname: nullable(form.surname),
        company: nullable(form.company),
        phone: nullable(form.phone),
        email: nullable(form.email),
        address_line: nullable(form.addressLine),
        address_suburb: nullable(form.addressSuburb),
        address_state: nullable(form.addressState),
        address_postcode: nullable(form.addressPostcode),
        notes: nullable(form.notes),
      }
      const response = await fetch(
        mode === "edit" && relationship
          ? `/api/clients/${clientId}/professional-relationships/${relationship.id}`
          : `/api/clients/${clientId}/professional-relationships`,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      )
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(responsePayload.error ?? "Failed to save professional relationship")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save professional relationship")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,50,56,0.22)] px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-[720px] flex-col rounded-[12px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#113238]">
              {mode === "edit" ? "Edit professional relationship" : "Add professional relationship"}
            </h2>
            <p className="text-[12px] text-[#6b7280]">Professional contact details for this client</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-1 text-[12px] text-[#113238] disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {serverError ? (
            <div className="rounded-[8px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <section className="space-y-3">
            <SectionHeading>Type & Authorisation</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Type" error={fieldErrors.relationshipType}>
                <select
                  value={form.relationshipType}
                  onChange={(event) => updateField("relationshipType", event.target.value)}
                  className={inputClassName}
                  required
                >
                  <option value="">Select type...</option>
                  {relationshipTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 self-end rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[12px] text-[#113238]">
                <input
                  type="checkbox"
                  checked={form.isAuthorised}
                  onChange={(event) => updateField("isAuthorised", event.target.checked)}
                />
                Client has authorised contact with this person
              </label>
            </div>
            {form.isAuthorised ? (
              <Field label="Authorisation expiry">
                <input
                  type="date"
                  value={form.authorisationExpiry}
                  onChange={(event) => updateField("authorisationExpiry", event.target.value)}
                  className={inputClassName}
                />
              </Field>
            ) : null}
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Contact</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="First name">
                <input
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>
              <Field label="Surname">
                <input
                  value={form.surname}
                  onChange={(event) => updateField("surname", event.target.value)}
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>
              <Field label="Company / firm">
                <input
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  maxLength={50}
                  className={inputClassName}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Address & Notes</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Address - Street">
                <input
                  value={form.addressLine}
                  onChange={(event) => updateField("addressLine", event.target.value)}
                  maxLength={200}
                  className={inputClassName}
                />
              </Field>
              <Field label="Address - Suburb">
                <input
                  value={form.addressSuburb}
                  onChange={(event) => updateField("addressSuburb", event.target.value)}
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>
              <Field label="Address - State">
                <input
                  value={form.addressState}
                  onChange={(event) => updateField("addressState", event.target.value)}
                  maxLength={50}
                  className={inputClassName}
                />
              </Field>
              <Field label="Address - Postcode">
                <input
                  value={form.addressPostcode}
                  onChange={(event) => updateField("addressPostcode", event.target.value)}
                  maxLength={20}
                  className={inputClassName}
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                maxLength={5000}
                className={textareaClassName}
              />
            </Field>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-[#e5e7eb] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-2 text-[13px] text-[#113238] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[8px] bg-[#113238] px-4 py-2 text-[13px] text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
