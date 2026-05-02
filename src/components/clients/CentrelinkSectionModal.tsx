"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { ClientDetail } from "@/types/client-record"

type CentrelinkSectionModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type EligibilityValue = "" | "yes" | "no" | "unknown"

type CentrelinkFormState = {
  isEligible: EligibilityValue
  benefitType: string
  crn: string
  hasConcessionCard: boolean
  concessionCardType: string
  hasGiftedAssets: boolean
  notes: string
}

const benefitTypeOptions = [
  { label: "Not recorded", value: "" },
  { label: "Age pension", value: "age_pension" },
  { label: "Disability support", value: "disability_support" },
  { label: "Family payments", value: "family_payments" },
  { label: "Carer payment", value: "carer_payment" },
  { label: "JobSeeker", value: "jobseeker" },
  { label: "None", value: "none" },
  { label: "Other", value: "other" },
] as const

const concessionCardTypeOptions = [
  { label: "Not recorded", value: "" },
  { label: "Pensioner Concession Card", value: "pensioner_concession_card" },
  { label: "Commonwealth Seniors Health Card", value: "cshc" },
  { label: "Health Care Card", value: "hcc" },
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

function eligibilityToFormValue(value: boolean | null | undefined): EligibilityValue {
  if (value === true) {
    return "yes"
  }

  if (value === false) {
    return "no"
  }

  return ""
}

function eligibilityToPayload(value: EligibilityValue) {
  if (value === "yes") {
    return true
  }

  if (value === "no") {
    return false
  }

  return null
}

function buildForm(clientDetail: ClientDetail): CentrelinkFormState {
  const centrelink = clientDetail.centrelink

  return {
    isEligible: eligibilityToFormValue(centrelink?.isEligible),
    benefitType: value(centrelink?.benefitType),
    crn: value(centrelink?.crn),
    hasConcessionCard: centrelink?.hasConcessionCard ?? false,
    concessionCardType: value(centrelink?.concessionCardType),
    hasGiftedAssets: centrelink?.hasGiftedAssets ?? false,
    notes: value(centrelink?.notes),
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

export default function CentrelinkSectionModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: CentrelinkSectionModalProps) {
  const [form, setForm] = useState<CentrelinkFormState>(() => buildForm(clientDetail))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(clientDetail))
    setFieldError(null)
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

  function updateField<Key extends keyof CentrelinkFormState>(
    key: Key,
    nextValue: CentrelinkFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function hasMeaningfulFirstSave() {
    return (
      eligibilityToPayload(form.isEligible) !== null ||
      nullable(form.benefitType) !== null ||
      nullable(form.crn) !== null ||
      form.hasConcessionCard ||
      form.hasGiftedAssets ||
      nullable(form.notes) !== null
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldError(null)
    setServerError(null)

    if (!clientDetail.centrelink && !hasMeaningfulFirstSave()) {
      setFieldError("Enter at least one Centrelink detail to save.")
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        is_eligible: eligibilityToPayload(form.isEligible),
        benefit_type: nullable(form.benefitType),
        crn: nullable(form.crn),
        has_concession_card: form.hasConcessionCard,
        concession_card_type: form.hasConcessionCard ? nullable(form.concessionCardType) : null,
        has_gifted_assets: form.hasGiftedAssets,
        notes: nullable(form.notes),
      }

      const response = await fetch(`/api/clients/${clientId}/centrelink`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(responsePayload.error ?? "Failed to save Centrelink details")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save Centrelink details")
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
            <h2 className="text-[16px] font-semibold text-[#113238]">Edit Centrelink details</h2>
            <p className="text-[12px] text-[#6b7280]">Eligibility, concession card, gifting, and notes</p>
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
            <SectionHeading>Eligibility</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Eligibility">
                <select
                  value={form.isEligible}
                  onChange={(event) => updateField("isEligible", event.target.value as EligibilityValue)}
                  className={inputClassName}
                >
                  <option value="">Not assessed</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Benefit type">
                <select
                  value={form.benefitType}
                  onChange={(event) => updateField("benefitType", event.target.value)}
                  className={inputClassName}
                >
                  {benefitTypeOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="CRN">
                <input
                  value={form.crn}
                  onChange={(event) => updateField("crn", event.target.value)}
                  maxLength={50}
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Concession card</SectionHeading>
            <label className="flex items-center gap-2 rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[12px] text-[#113238]">
              <input
                type="checkbox"
                checked={form.hasConcessionCard}
                onChange={(event) => updateField("hasConcessionCard", event.target.checked)}
              />
              Has concession card
            </label>

            {form.hasConcessionCard ? (
              <Field label="Concession card type">
                <select
                  value={form.concessionCardType}
                  onChange={(event) => updateField("concessionCardType", event.target.value)}
                  className={inputClassName}
                >
                  {concessionCardTypeOptions.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Gifted assets</SectionHeading>
            <label className="flex items-start gap-2 rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[12px] text-[#113238]">
              <input
                type="checkbox"
                checked={form.hasGiftedAssets}
                onChange={(event) => updateField("hasGiftedAssets", event.target.checked)}
                className="mt-[2px]"
              />
              <span>
                <span className="block">Has gifted assets</span>
                <span className="block text-[11px] leading-[1.4] text-[#6b7280]">
                  Tracks whether gifts have been made; specific amounts and dates not captured at present.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Notes</SectionHeading>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                maxLength={5000}
                className={textareaClassName}
              />
            </Field>
          </section>

          {fieldError ? (
            <div className="rounded-[8px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
              {fieldError}
            </div>
          ) : null}
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
