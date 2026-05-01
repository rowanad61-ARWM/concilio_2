"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type EmploymentSectionModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type EmploymentFormState = {
  employmentStatus: string
  employerName: string
  occupation: string
  industry: string
  employmentType: string
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"

const employmentStatusOptions = ["employed", "self_employed", "retired", "unemployed", "student", "other"]
const employmentTypeOptions = ["full_time", "part_time", "casual", "contract", "other"]

function formatOption(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildForm(client: ClientDetail): EmploymentFormState {
  return {
    employmentStatus: client.employment?.employmentStatus ?? "",
    employerName: client.employment?.employerName ?? "",
    occupation: client.employment?.occupation ?? "",
    industry: client.employment?.industry ?? "",
    employmentType: client.employment?.employmentType ?? "",
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
      {children}
    </label>
  )
}

export default function EmploymentSectionModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: EmploymentSectionModalProps) {
  const [form, setForm] = useState<EmploymentFormState>(() => buildForm(clientDetail))
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

  function updateField<Key extends keyof EmploymentFormState>(key: Key, value: EmploymentFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
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
          employmentStatus: nullable(form.employmentStatus),
          employerName: nullable(form.employerName),
          occupation: nullable(form.occupation),
          industry: nullable(form.industry),
          employmentType: nullable(form.employmentType),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update employment")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update employment")
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
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Employment</p>
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

        <div className="space-y-4 px-5 py-4">
          {serverError ? (
            <div className="rounded-[10px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {serverError}
            </div>
          ) : null}

          <Field label="Employment status">
            <select value={form.employmentStatus} onChange={(event) => updateField("employmentStatus", event.target.value)} className={inputClassName}>
              <option value="">Select</option>
              {employmentStatusOptions.map((option) => (
                <option key={option} value={option}>{formatOption(option)}</option>
              ))}
            </select>
          </Field>

          <Field label="Employer">
            <input value={form.employerName} onChange={(event) => updateField("employerName", event.target.value)} className={inputClassName} />
          </Field>

          <Field label="Occupation">
            <input value={form.occupation} onChange={(event) => updateField("occupation", event.target.value)} className={inputClassName} />
          </Field>

          <Field label="Industry">
            <input value={form.industry} onChange={(event) => updateField("industry", event.target.value)} className={inputClassName} />
          </Field>

          <Field label="Employment type">
            <select value={form.employmentType} onChange={(event) => updateField("employmentType", event.target.value)} className={inputClassName}>
              <option value="">Select</option>
              {employmentTypeOptions.map((option) => (
                <option key={option} value={option}>{formatOption(option)}</option>
              ))}
            </select>
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
