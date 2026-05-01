"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type HouseholdSectionModalProps = {
  householdId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type HouseholdFormState = {
  salutationInformal: string
  addressTitleFormal: string
  householdNotes: string
}

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

function buildForm(clientDetail: ClientDetail): HouseholdFormState {
  return {
    salutationInformal: value(clientDetail.household?.salutationInformal),
    addressTitleFormal: value(clientDetail.household?.addressTitleFormal),
    householdNotes: value(clientDetail.household?.householdNotes),
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
      {children}
    </label>
  )
}

export default function HouseholdSectionModal({
  householdId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: HouseholdSectionModalProps) {
  const [form, setForm] = useState<HouseholdFormState>(() => buildForm(clientDetail))
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

  function updateField<Key extends keyof HouseholdFormState>(key: Key, nextValue: HouseholdFormState[Key]) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/households/${householdId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salutation_informal: nullable(form.salutationInformal),
          address_title_formal: nullable(form.addressTitleFormal),
          household_notes: nullable(form.householdNotes),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update household")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update household")
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
        className="w-full max-w-xl rounded-[14px] bg-white shadow-[0_18px_60px_rgba(17,50,56,0.22)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Household</p>
            <h2 className="text-[18px] font-semibold text-[#113238]">
              {clientDetail.household?.name ?? clientDetail.displayName}
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

        <div className="space-y-4 px-5 py-4">
          {serverError ? (
            <div className="rounded-[10px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <Field label="Salutation (informal)">
            <input
              maxLength={200}
              value={form.salutationInformal}
              onChange={(event) => updateField("salutationInformal", event.target.value)}
              placeholder="e.g. Bob & Mary"
              className={inputClassName}
            />
          </Field>

          <Field label="Address title (formal)">
            <input
              maxLength={200}
              value={form.addressTitleFormal}
              onChange={(event) => updateField("addressTitleFormal", event.target.value)}
              placeholder="e.g. Mr & Mrs Soprano"
              className={inputClassName}
            />
          </Field>

          <Field label="Notes">
            <textarea
              maxLength={5000}
              value={form.householdNotes}
              onChange={(event) => updateField("householdNotes", event.target.value)}
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
