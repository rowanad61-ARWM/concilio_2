"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { PowerOfAttorney } from "@/types/client-record"

type PowerOfAttorneyModalProps = {
  clientId: string
  mode: "create" | "edit"
  powerOfAttorney?: PowerOfAttorney | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type PowerOfAttorneyFormState = {
  poaType: string
  entityType: string
  firstName: string
  surname: string
  preferredName: string
  location: string
  notes: string
}

const poaTypeOptions = [
  { label: "Enduring", value: "enduring" },
  { label: "General", value: "general" },
  { label: "Medical", value: "medical" },
  { label: "Financial", value: "financial" },
  { label: "Other", value: "other" },
] as const

const entityTypeOptions = [
  { label: "Individual person", value: "person" },
  { label: "Trustee company", value: "trustee_company" },
  { label: "Other", value: "other" },
] as const

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"
const textareaClassName = `${inputClassName} min-h-[110px] resize-y`

function value(value: string | null | undefined) {
  return value ?? ""
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildForm(powerOfAttorney?: PowerOfAttorney | null): PowerOfAttorneyFormState {
  return {
    poaType: powerOfAttorney?.poaType ?? "",
    entityType: powerOfAttorney?.entityType ?? "",
    firstName: value(powerOfAttorney?.firstName),
    surname: value(powerOfAttorney?.surname),
    preferredName: value(powerOfAttorney?.preferredName),
    location: value(powerOfAttorney?.location),
    notes: value(powerOfAttorney?.notes),
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

export default function PowerOfAttorneyModal({
  clientId,
  mode,
  powerOfAttorney,
  isOpen,
  onClose,
  onSaved,
}: PowerOfAttorneyModalProps) {
  const [form, setForm] = useState<PowerOfAttorneyFormState>(() => buildForm(powerOfAttorney))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(mode === "edit" ? powerOfAttorney : null))
    setFieldErrors({})
    setServerError(null)
  }, [isOpen, mode, powerOfAttorney])

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

  function updateField<Key extends keyof PowerOfAttorneyFormState>(
    key: Key,
    nextValue: PowerOfAttorneyFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!form.poaType) {
      nextErrors.poaType = "PoA type is required."
    }

    if (!form.entityType) {
      nextErrors.entityType = "Attorney type is required."
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
        poa_type: form.poaType,
        entity_type: form.entityType,
        first_name: nullable(form.firstName),
        surname: nullable(form.surname),
        preferred_name: nullable(form.preferredName),
        location: nullable(form.location),
        notes: nullable(form.notes),
      }

      const response = await fetch(
        mode === "edit" && powerOfAttorney
          ? `/api/clients/${clientId}/powers-of-attorney/${powerOfAttorney.id}`
          : `/api/clients/${clientId}/powers-of-attorney`,
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
        throw new Error(responsePayload.error ?? "Failed to save power of attorney")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save power of attorney")
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
              {mode === "edit" ? "Edit power of attorney" : "Add power of attorney"}
            </h2>
            <p className="text-[12px] text-[#6b7280]">Attorney details and document location</p>
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

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="PoA type" error={fieldErrors.poaType}>
              <select
                value={form.poaType}
                onChange={(event) => updateField("poaType", event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">Select PoA type...</option>
                {poaTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Attorney type" error={fieldErrors.entityType}>
              <select
                value={form.entityType}
                onChange={(event) => updateField("entityType", event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">Select attorney type...</option>
                {entityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

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

          <Field label="Preferred name">
            <input
              value={form.preferredName}
              onChange={(event) => updateField("preferredName", event.target.value)}
              maxLength={200}
              className={inputClassName}
            />
          </Field>

          <Field label="Document location">
            <input
              value={form.location}
              onChange={(event) => updateField("location", event.target.value)}
              maxLength={500}
              className={inputClassName}
            />
          </Field>

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
