"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientHouseholdMember } from "@/types/client-record"

type AdultMemberOption = {
  id: string
  displayName: string
}

type DependantModalProps = {
  householdId: string
  clientId: string
  mode: "create" | "edit"
  member?: ClientHouseholdMember | null
  householdAdultMembers: AdultMemberOption[]
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type DependantFormState = {
  firstName: string
  lastName: string
  dateOfBirth: string
  relation: string
  relationToMemberId: string
  isFinancialDependant: boolean
  dependantUntilAge: string
  dependantNotes: string
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"
const textareaClassName = `${inputClassName} min-h-[96px] resize-y`

const relationSuggestions = ["Child", "Son", "Daughter", "Step child", "Stepson", "Stepdaughter", "Foster child", "Parent", "Sibling", "Other"]

function value(value: string | null | undefined) {
  return value ?? ""
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ""
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: "", lastName: "" }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" }
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  }
}

function relationLabel(value: string | null | undefined) {
  switch (value) {
    case "child":
      return "Child"
    case "step_child":
      return "Step child"
    case "foster_child":
      return "Foster child"
    case "parent":
      return "Parent"
    case "sibling":
      return "Sibling"
    case "other":
      return "Other"
    default:
      return value ?? ""
  }
}

function normalizeRelation(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")
  if (!normalized) {
    return null
  }

  switch (normalized) {
    case "child":
    case "son":
    case "daughter":
      return "child"
    case "step child":
    case "stepchild":
    case "stepson":
    case "stepdaughter":
      return "step_child"
    case "foster child":
    case "fosterchild":
      return "foster_child"
    case "parent":
    case "mother":
    case "father":
      return "parent"
    case "sibling":
    case "brother":
    case "sister":
      return "sibling"
    case "other":
      return "other"
    default:
      return "invalid"
  }
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildForm(member: ClientHouseholdMember | null | undefined): DependantFormState {
  const fallbackNames = splitDisplayName(member?.displayName ?? "")
  const dependantUntilAge = member?.dependantUntilAge

  return {
    firstName: value(member?.legalGivenName) || fallbackNames.firstName,
    lastName: value(member?.legalFamilyName) || fallbackNames.lastName,
    dateOfBirth: dateInput(member?.dateOfBirth),
    relation: relationLabel(member?.relation),
    relationToMemberId: member?.relationToMemberId ?? "",
    isFinancialDependant: member?.isFinancialDependant ?? false,
    dependantUntilAge:
      dependantUntilAge !== null && dependantUntilAge !== undefined ? String(dependantUntilAge) : "",
    dependantNotes: value(member?.dependantNotes),
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

export default function DependantModal({
  householdId,
  clientId: _clientId,
  mode,
  member,
  householdAdultMembers,
  isOpen,
  onClose,
  onSaved,
}: DependantModalProps) {
  const [form, setForm] = useState<DependantFormState>(() => buildForm(member))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(mode === "edit" ? member : null))
    setFieldErrors({})
    setServerError(null)
  }, [isOpen, member, mode])

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

  function updateField<Key extends keyof DependantFormState>(key: Key, nextValue: DependantFormState[Key]) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    const normalizedRelation = normalizeRelation(form.relation)

    if (!form.firstName.trim()) {
      nextErrors.firstName = "First name is required."
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = "Last name is required."
    }

    if (!form.dateOfBirth) {
      nextErrors.dateOfBirth = "Date of birth is required."
    }

    if (normalizedRelation === "invalid") {
      nextErrors.relation = "Use Child, Son, Daughter, Step child, Foster child, Parent, Sibling, or Other."
    }

    if (form.isFinancialDependant && form.dependantUntilAge.trim()) {
      const parsedAge = Number(form.dependantUntilAge)
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 30) {
        nextErrors.dependantUntilAge = "Age must be a whole number from 0 to 30."
      }
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)

    if (!validate()) {
      return
    }

    const normalizedRelation = normalizeRelation(form.relation)
    const dependantUntilAge =
      form.isFinancialDependant && form.dependantUntilAge.trim()
        ? Number(form.dependantUntilAge)
        : null

    setIsSubmitting(true)
    try {
      const endpoint =
        mode === "create"
          ? `/api/households/${householdId}/members`
          : `/api/households/${householdId}/members/${member?.id ?? ""}`
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role_in_household: "dependant",
          legal_given_name: form.firstName.trim(),
          legal_family_name: form.lastName.trim(),
          date_of_birth: form.dateOfBirth,
          relation: normalizedRelation === "invalid" ? null : normalizedRelation,
          relation_to_member_id: form.relationToMemberId || null,
          is_financial_dependant: form.isFinancialDependant,
          dependant_until_age: dependantUntilAge,
          dependant_notes: nullable(form.dependantNotes),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save dependant")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save dependant")
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_18px_60px_rgba(17,50,56,0.22)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Dependant</p>
            <h2 className="text-[18px] font-semibold text-[#113238]">
              {mode === "create" ? "Add dependant" : `Edit ${member?.displayName ?? "dependant"}`}
            </h2>
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

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {serverError ? (
            <div className="rounded-[10px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="First name" error={fieldErrors.firstName}>
              <input
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className={inputClassName}
                required
              />
            </Field>
            <Field label="Last name" error={fieldErrors.lastName}>
              <input
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className={inputClassName}
                required
              />
            </Field>
            <Field label="Date of birth" error={fieldErrors.dateOfBirth}>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                className={inputClassName}
                required
              />
            </Field>
            <Field label="Relation to family" error={fieldErrors.relation}>
              <input
                list="dependant-relation-options"
                value={form.relation}
                onChange={(event) => updateField("relation", event.target.value)}
                placeholder="e.g. Son"
                className={inputClassName}
              />
              <datalist id="dependant-relation-options">
                {relationSuggestions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </Field>
            <Field label="Related to which adult">
              <select
                value={form.relationToMemberId}
                onChange={(event) => updateField("relationToMemberId", event.target.value)}
                className={inputClassName}
              >
                <option value="">Select</option>
                {householdAdultMembers.map((adult) => (
                  <option key={adult.id} value={adult.id}>
                    {adult.displayName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-[#113238]">
            <input
              type="checkbox"
              checked={form.isFinancialDependant}
              onChange={(event) => updateField("isFinancialDependant", event.target.checked)}
            />
            Financial dependant
          </label>

          {form.isFinancialDependant ? (
            <Field label="Dependant until age" error={fieldErrors.dependantUntilAge}>
              <input
                type="number"
                min="0"
                max="30"
                value={form.dependantUntilAge}
                onChange={(event) => updateField("dependantUntilAge", event.target.value)}
                className={inputClassName}
              />
            </Field>
          ) : null}

          <Field label="Notes">
            <textarea
              maxLength={2000}
              value={form.dependantNotes}
              onChange={(event) => updateField("dependantNotes", event.target.value)}
              className={textareaClassName}
            />
          </Field>
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
