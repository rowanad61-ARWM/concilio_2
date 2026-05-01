"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type EstateScalarsModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type EstateScalarsFormState = {
  willExists: boolean
  willIsCurrent: boolean
  willDate: string
  willLocation: string
  estatePlanningNotes: string
  funeralPlanStatus: string
}

const funeralPlanStatusOptions = [
  { label: "Not recorded", value: "" },
  { label: "In place", value: "in_place" },
  { label: "Pre-paid", value: "pre_paid" },
  { label: "Not in place", value: "not_in_place" },
  { label: "Unknown", value: "unknown" },
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

function buildForm(clientDetail: ClientDetail): EstateScalarsFormState {
  return {
    willExists: clientDetail.person?.willExists ?? false,
    willIsCurrent: clientDetail.person?.willIsCurrent ?? false,
    willDate: dateInput(clientDetail.person?.willDate),
    willLocation: value(clientDetail.person?.willLocation),
    estatePlanningNotes: value(clientDetail.person?.estatePlanningNotes),
    funeralPlanStatus: value(clientDetail.person?.funeralPlanStatus),
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

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">{children}</h3>
}

export default function EstateScalarsModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: EstateScalarsModalProps) {
  const [form, setForm] = useState<EstateScalarsFormState>(() => buildForm(clientDetail))
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

  if (!isOpen) {
    return null
  }

  function updateField<Key extends keyof EstateScalarsFormState>(
    key: Key,
    nextValue: EstateScalarsFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setServerError(null)

    try {
      const payload = {
        will_exists: form.willExists,
        will_is_current: form.willExists ? form.willIsCurrent : null,
        will_date: form.willExists ? nullable(form.willDate) : null,
        will_location: form.willExists ? nullable(form.willLocation) : null,
        estate_planning_notes: nullable(form.estatePlanningNotes),
        funeral_plan_status: nullable(form.funeralPlanStatus),
      }

      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(responsePayload.error ?? "Failed to save estate details")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save estate details")
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
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col rounded-[12px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#113238]">Edit estate details</h2>
            <p className="text-[12px] text-[#6b7280]">Will, estate planning, and funeral planning details</p>
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
            <SectionHeading>Will</SectionHeading>
            <label className="flex items-center gap-2 rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[12px] text-[#113238]">
              <input
                type="checkbox"
                checked={form.willExists}
                onChange={(event) => updateField("willExists", event.target.checked)}
              />
              Will exists
            </label>

            {form.willExists ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[12px] text-[#113238] md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.willIsCurrent}
                    onChange={(event) => updateField("willIsCurrent", event.target.checked)}
                  />
                  Will is current
                </label>
                <Field label="Will date">
                  <input
                    type="date"
                    value={form.willDate}
                    onChange={(event) => updateField("willDate", event.target.value)}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Will location">
                  <input
                    value={form.willLocation}
                    onChange={(event) => updateField("willLocation", event.target.value)}
                    maxLength={500}
                    className={inputClassName}
                  />
                </Field>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Estate planning</SectionHeading>
            <Field label="Estate planning notes">
              <textarea
                value={form.estatePlanningNotes}
                onChange={(event) => updateField("estatePlanningNotes", event.target.value)}
                maxLength={5000}
                className={textareaClassName}
              />
            </Field>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Funeral</SectionHeading>
            <Field label="Funeral plan status">
              <select
                value={form.funeralPlanStatus}
                onChange={(event) => updateField("funeralPlanStatus", event.target.value)}
                className={inputClassName}
              >
                {funeralPlanStatusOptions.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
