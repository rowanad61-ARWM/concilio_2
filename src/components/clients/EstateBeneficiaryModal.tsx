"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { EstateBeneficiary } from "@/types/client-record"

type EstateBeneficiaryModalProps = {
  clientId: string
  mode: "create" | "edit"
  beneficiary?: EstateBeneficiary | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type EstateBeneficiaryFormState = {
  entityType: string
  firstName: string
  surname: string
  preferredName: string
  ageOfEntitlement: string
  notes: string
}

const entityTypeOptions = [
  { label: "Individual person", value: "person" },
  { label: "Charity", value: "charity" },
  { label: "Trust", value: "trust" },
  { label: "Estate", value: "estate" },
  { label: "Other", value: "other" },
] as const

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"
const textareaClassName = `${inputClassName} min-h-[110px] resize-y`

function value(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function nullableInteger(value: string) {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : null
}

function buildForm(beneficiary?: EstateBeneficiary | null): EstateBeneficiaryFormState {
  return {
    entityType: beneficiary?.entityType ?? "",
    firstName: value(beneficiary?.firstName),
    surname: value(beneficiary?.surname),
    preferredName: value(beneficiary?.preferredName),
    ageOfEntitlement: value(beneficiary?.ageOfEntitlement),
    notes: value(beneficiary?.notes),
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

export default function EstateBeneficiaryModal({
  clientId,
  mode,
  beneficiary,
  isOpen,
  onClose,
  onSaved,
}: EstateBeneficiaryModalProps) {
  const [form, setForm] = useState<EstateBeneficiaryFormState>(() => buildForm(beneficiary))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(mode === "edit" ? beneficiary : null))
    setFieldErrors({})
    setServerError(null)
  }, [beneficiary, isOpen, mode])

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

  function updateField<Key extends keyof EstateBeneficiaryFormState>(
    key: Key,
    nextValue: EstateBeneficiaryFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    const trimmedAge = form.ageOfEntitlement.trim()

    if (!form.entityType) {
      nextErrors.entityType = "Type is required."
    }

    if (trimmedAge) {
      if (!/^\d+$/.test(trimmedAge)) {
        nextErrors.ageOfEntitlement = "Age must be a whole number."
      } else {
        const parsedAge = Number(trimmedAge)
        if (parsedAge < 0 || parsedAge > 100) {
          nextErrors.ageOfEntitlement = "Age must be between 0 and 100."
        }
      }
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
        entity_type: form.entityType,
        first_name: nullable(form.firstName),
        surname: nullable(form.surname),
        preferred_name: nullable(form.preferredName),
        age_of_entitlement: nullableInteger(form.ageOfEntitlement),
        notes: nullable(form.notes),
      }

      const response = await fetch(
        mode === "edit" && beneficiary
          ? `/api/clients/${clientId}/estate-beneficiaries/${beneficiary.id}`
          : `/api/clients/${clientId}/estate-beneficiaries`,
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
        throw new Error(responsePayload.error ?? "Failed to save beneficiary")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save beneficiary")
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
        className="flex max-h-[90vh] w-full max-w-[620px] flex-col rounded-[12px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#113238]">
              {mode === "edit" ? "Edit beneficiary" : "Add beneficiary"}
            </h2>
            <p className="text-[12px] text-[#6b7280]">Beneficiary details for this client&apos;s estate</p>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {serverError ? (
            <div className="rounded-[8px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <Field label="Type" error={fieldErrors.entityType}>
            <select
              value={form.entityType}
              onChange={(event) => updateField("entityType", event.target.value)}
              className={inputClassName}
              required
            >
              <option value="">Select type...</option>
              {entityTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

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
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Preferred name">
              <input
                value={form.preferredName}
                onChange={(event) => updateField("preferredName", event.target.value)}
                maxLength={200}
                className={inputClassName}
              />
            </Field>
            <Field label="Age of entitlement" error={fieldErrors.ageOfEntitlement}>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.ageOfEntitlement}
                onChange={(event) => updateField("ageOfEntitlement", event.target.value)}
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
