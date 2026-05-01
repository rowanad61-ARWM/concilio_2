"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type PersonalSectionModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type PersonalFormState = {
  title: string
  firstName: string
  legalMiddleNames: string
  lastName: string
  preferredName: string
  maidenName: string
  mothersMaidenName: string
  dateOfBirth: string
  gender: string
  genderPronouns: string
  relationshipStatus: string
  placeOfBirth: string
  countryOfBirth: string
  countryOfResidence: string
  countryOfTaxResidency: string
  taxResidentStatus: string
  residentStatus: string
  isPepRisk: boolean
  pepNotes: string
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
  emergencyContactEmail: string
  emergencyContactNotes: string
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"
const textareaClassName = `${inputClassName} min-h-[86px] resize-y`

const relationshipOptions = ["single", "married", "de_facto", "separated", "divorced", "widowed"]
const residentStatusOptions = ["australian_citizen", "permanent_resident", "temporary_resident", "other"]
const taxResidentStatusOptions = ["resident", "non_resident", "temporary_resident"]

function value(value: string | null | undefined) {
  return value ?? ""
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ""
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function optionalRequired(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function formatOption(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildForm(client: ClientDetail): PersonalFormState {
  return {
    title: value(client.person?.title),
    firstName: value(client.person?.legalGivenName),
    legalMiddleNames: value(client.person?.legalMiddleNames),
    lastName: value(client.person?.legalFamilyName),
    preferredName: value(client.person?.preferredName),
    maidenName: value(client.person?.maidenName),
    mothersMaidenName: value(client.person?.mothersMaidenName),
    dateOfBirth: dateValue(client.person?.dateOfBirth),
    gender: value(client.person?.gender),
    genderPronouns: value(client.person?.genderPronouns),
    relationshipStatus: value(client.person?.relationshipStatus),
    placeOfBirth: value(client.person?.placeOfBirth),
    countryOfBirth: value(client.person?.countryOfBirth),
    countryOfResidence: value(client.person?.countryOfResidence),
    countryOfTaxResidency: value(client.person?.countryOfTaxResidency),
    taxResidentStatus: value(client.person?.taxResidentStatus),
    residentStatus: value(client.person?.residentStatus),
    isPepRisk: client.person?.isPepRisk ?? false,
    pepNotes: value(client.person?.pepNotes),
    emergencyContactName: value(client.person?.emergencyContactName),
    emergencyContactRelationship: value(client.person?.emergencyContactRelationship),
    emergencyContactPhone: value(client.person?.emergencyContactPhone),
    emergencyContactEmail: value(client.person?.emergencyContactEmail),
    emergencyContactNotes: value(client.person?.emergencyContactNotes),
  }
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
      {children}
    </label>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">{children}</h3>
}

export default function PersonalSectionModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: PersonalSectionModalProps) {
  const [form, setForm] = useState<PersonalFormState>(() => buildForm(clientDetail))
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(clientDetail))
    setServerError(null)
  }, [clientDetail, isOpen])

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

  function updateField<Key extends keyof PersonalFormState>(key: Key, nextValue: PersonalFormState[Key]) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: nullable(form.title),
          firstName: optionalRequired(form.firstName),
          legalMiddleNames: nullable(form.legalMiddleNames),
          lastName: optionalRequired(form.lastName),
          preferredName: nullable(form.preferredName),
          maidenName: nullable(form.maidenName),
          mothersMaidenName: nullable(form.mothersMaidenName),
          dateOfBirth: form.dateOfBirth || undefined,
          gender: nullable(form.gender),
          genderPronouns: nullable(form.genderPronouns),
          relationshipStatus: nullable(form.relationshipStatus),
          placeOfBirth: nullable(form.placeOfBirth),
          countryOfBirth: nullable(form.countryOfBirth),
          countryOfResidence: nullable(form.countryOfResidence),
          countryOfTaxResidency: nullable(form.countryOfTaxResidency),
          taxResidentStatus: nullable(form.taxResidentStatus),
          residentStatus: nullable(form.residentStatus),
          isPepRisk: form.isPepRisk,
          pepNotes: form.isPepRisk ? nullable(form.pepNotes) : null,
          emergencyContactName: nullable(form.emergencyContactName),
          emergencyContactRelationship: nullable(form.emergencyContactRelationship),
          emergencyContactPhone: nullable(form.emergencyContactPhone),
          emergencyContactEmail: nullable(form.emergencyContactEmail),
          emergencyContactNotes: nullable(form.emergencyContactNotes),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update personal details")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update personal details")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,50,56,0.35)] p-4"
      onMouseDown={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_18px_60px_rgba(17,50,56,0.22)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Personal details</p>
            <h2 className="text-[18px] font-semibold text-[#113238]">{clientDetail.displayName}</h2>
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

        <div className="space-y-6 overflow-y-auto px-5 py-4">
          {serverError ? (
            <div className="rounded-[10px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <section className="space-y-3">
            <SectionTitle>Personal</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input value={form.title} onChange={(event) => updateField("title", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="First name">
                <input value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Middle names">
                <input value={form.legalMiddleNames} onChange={(event) => updateField("legalMiddleNames", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Last name">
                <input value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Preferred name">
                <input value={form.preferredName} onChange={(event) => updateField("preferredName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Maiden name">
                <input value={form.maidenName} onChange={(event) => updateField("maidenName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Mother's maiden name">
                <input value={form.mothersMaidenName} onChange={(event) => updateField("mothersMaidenName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Gender">
                <input value={form.gender} onChange={(event) => updateField("gender", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Gender pronouns">
                <input value={form.genderPronouns} onChange={(event) => updateField("genderPronouns", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Relationship status">
                <select value={form.relationshipStatus} onChange={(event) => updateField("relationshipStatus", event.target.value)} className={inputClassName}>
                  <option value="">Select</option>
                  {relationshipOptions.map((option) => (
                    <option key={option} value={option}>{formatOption(option)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Place of birth">
                <input value={form.placeOfBirth} onChange={(event) => updateField("placeOfBirth", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Country of birth">
                <input value={form.countryOfBirth} onChange={(event) => updateField("countryOfBirth", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Country of residence">
                <input value={form.countryOfResidence} onChange={(event) => updateField("countryOfResidence", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Country of tax residency">
                <input value={form.countryOfTaxResidency} onChange={(event) => updateField("countryOfTaxResidency", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Tax resident status">
                <select value={form.taxResidentStatus} onChange={(event) => updateField("taxResidentStatus", event.target.value)} className={inputClassName}>
                  <option value="">Select</option>
                  {taxResidentStatusOptions.map((option) => (
                    <option key={option} value={option}>{formatOption(option)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Resident status">
                <select value={form.residentStatus} onChange={(event) => updateField("residentStatus", event.target.value)} className={inputClassName}>
                  <option value="">Select</option>
                  {residentStatusOptions.map((option) => (
                    <option key={option} value={option}>{formatOption(option)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Identity</SectionTitle>
            <label className="flex items-center gap-2 text-[13px] text-[#113238]">
              <input type="checkbox" checked={form.isPepRisk} onChange={(event) => updateField("isPepRisk", event.target.checked)} />
              Politically exposed person risk
            </label>
            {form.isPepRisk ? (
              <Field label="PEP notes">
                <textarea value={form.pepNotes} onChange={(event) => updateField("pepNotes", event.target.value)} className={textareaClassName} />
              </Field>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionTitle>Emergency Contact</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input maxLength={200} value={form.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Relationship">
                <input maxLength={100} value={form.emergencyContactRelationship} onChange={(event) => updateField("emergencyContactRelationship", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Phone">
                <input maxLength={50} value={form.emergencyContactPhone} onChange={(event) => updateField("emergencyContactPhone", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Email">
                <input maxLength={200} value={form.emergencyContactEmail} onChange={(event) => updateField("emergencyContactEmail", event.target.value)} className={inputClassName} />
              </Field>
              <Field label="Notes" className="md:col-span-2">
                <textarea maxLength={2000} value={form.emergencyContactNotes} onChange={(event) => updateField("emergencyContactNotes", event.target.value)} className={textareaClassName} />
              </Field>
            </div>
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
