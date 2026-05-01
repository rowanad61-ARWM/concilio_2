"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type ContactSectionModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type ContactFormState = {
  emailPrimary: string
  emailAlternate: string
  mobilePhone: string
  preferredContactMethod: string
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"

const preferredContactMethodOptions = ["email", "phone", "sms", "post"]

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function formatOption(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function buildForm(client: ClientDetail): ContactFormState {
  return {
    emailPrimary: client.person?.emailPrimary ?? client.resolvedEmail ?? "",
    emailAlternate: client.person?.emailAlternate ?? "",
    mobilePhone: client.person?.mobilePhone ?? client.resolvedMobile ?? "",
    preferredContactMethod:
      client.person?.preferredContactMethod ?? client.resolvedPreferredContactMethod ?? "",
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

export default function ContactSectionModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: ContactSectionModalProps) {
  const [form, setForm] = useState<ContactFormState>(() => buildForm(clientDetail))
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

  function updateField<Key extends keyof ContactFormState>(key: Key, value: ContactFormState[Key]) {
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
          email: nullable(form.emailPrimary),
          emailAlternate: nullable(form.emailAlternate),
          mobile: nullable(form.mobilePhone),
          preferredContactMethod: nullable(form.preferredContactMethod),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update contact details")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update contact details")
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
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Contact</p>
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

          <Field label="Primary email">
            <input
              type="email"
              value={form.emailPrimary}
              onChange={(event) => updateField("emailPrimary", event.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Alternate email">
            <input
              type="email"
              maxLength={200}
              value={form.emailAlternate}
              onChange={(event) => updateField("emailAlternate", event.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Mobile">
            <input value={form.mobilePhone} onChange={(event) => updateField("mobilePhone", event.target.value)} className={inputClassName} />
          </Field>

          <Field label="Preferred contact method">
            <select
              value={form.preferredContactMethod}
              onChange={(event) => updateField("preferredContactMethod", event.target.value)}
              className={inputClassName}
            >
              <option value="">Select</option>
              {preferredContactMethodOptions.map((option) => (
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
