"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import type { SuperPensionAccount } from "@/types/client-record"

type SuperPensionAccountModalProps = {
  clientId: string
  mode: "create" | "edit"
  account?: SuperPensionAccount | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type SuperPensionAccountFormState = {
  accountType: string
  providerName: string
  productName: string
  memberNumber: string
  currentBalance: string
  balanceAsAt: string
  contributionsYtd: string
  investmentOption: string
  beneficiaryNominationType: string
  beneficiaryNominationNotes: string
  insuranceInFundSummary: string
  bpayBillerCode: string
  bpayReference: string
  notes: string
}

const accountTypeOptions = [
  { label: "Super (accumulation)", value: "super" },
  { label: "Pension", value: "pension" },
  { label: "Transition to retirement (TTR)", value: "ttr" },
  { label: "Defined benefit", value: "defined_benefit" },
  { label: "SMSF", value: "smsf" },
] as const

const nominationTypeOptions = [
  { label: "Binding", value: "binding" },
  { label: "Non-binding", value: "non_binding" },
  { label: "Reversionary", value: "reversionary" },
  { label: "None", value: "none" },
  { label: "Unknown", value: "unknown" },
] as const

const amountErrorMessage = "Enter a non-negative amount with up to 2 decimal places (no commas or $)."

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

function nullableAmount(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isValidAmount(value: string) {
  const trimmed = value.trim()
  return !trimmed || /^\d+(\.\d{1,2})?$/.test(trimmed)
}

function buildForm(account?: SuperPensionAccount | null): SuperPensionAccountFormState {
  return {
    accountType: account?.accountType ?? "",
    providerName: value(account?.providerName),
    productName: value(account?.productName),
    memberNumber: value(account?.memberNumber),
    currentBalance: value(account?.currentBalance),
    balanceAsAt: dateInput(account?.balanceAsAt),
    contributionsYtd: value(account?.contributionsYtd),
    investmentOption: value(account?.investmentOption),
    beneficiaryNominationType: value(account?.beneficiaryNominationType),
    beneficiaryNominationNotes: value(account?.beneficiaryNominationNotes),
    insuranceInFundSummary: value(account?.insuranceInFundSummary),
    bpayBillerCode: value(account?.bpayBillerCode),
    bpayReference: value(account?.bpayReference),
    notes: value(account?.notes),
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

export default function SuperPensionAccountModal({
  clientId,
  mode,
  account,
  isOpen,
  onClose,
  onSaved,
}: SuperPensionAccountModalProps) {
  const [form, setForm] = useState<SuperPensionAccountFormState>(() => buildForm(account))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm(buildForm(mode === "edit" ? account : null))
    setFieldErrors({})
    setServerError(null)
  }, [account, isOpen, mode])

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

  function updateField<Key extends keyof SuperPensionAccountFormState>(
    key: Key,
    nextValue: SuperPensionAccountFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: nextValue }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!form.accountType) {
      nextErrors.accountType = "Account type is required."
    }

    if (!form.providerName.trim()) {
      nextErrors.providerName = "Provider name is required."
    }

    if (!isValidAmount(form.currentBalance)) {
      nextErrors.currentBalance = amountErrorMessage
    }

    if (!isValidAmount(form.contributionsYtd)) {
      nextErrors.contributionsYtd = amountErrorMessage
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
        account_type: form.accountType,
        provider_name: form.providerName.trim(),
        product_name: nullable(form.productName),
        member_number: nullable(form.memberNumber),
        current_balance: nullableAmount(form.currentBalance),
        balance_as_at: nullable(form.balanceAsAt),
        contributions_ytd: nullableAmount(form.contributionsYtd),
        investment_option: nullable(form.investmentOption),
        beneficiary_nomination_type: nullable(form.beneficiaryNominationType),
        beneficiary_nomination_notes: nullable(form.beneficiaryNominationNotes),
        insurance_in_fund_summary: nullable(form.insuranceInFundSummary),
        bpay_biller_code: nullable(form.bpayBillerCode),
        bpay_reference: nullable(form.bpayReference),
        notes: nullable(form.notes),
      }

      const response = await fetch(
        mode === "edit" && account
          ? `/api/clients/${clientId}/super-pension-accounts/${account.id}`
          : `/api/clients/${clientId}/super-pension-accounts`,
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
        throw new Error(responsePayload.error ?? "Failed to save super/pension account")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to save super/pension account")
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
        className="flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-[12px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#113238]">
              {mode === "edit" ? "Edit super/pension account" : "Add super/pension account"}
            </h2>
            <p className="text-[12px] text-[#6b7280]">Super, pension, nomination and contribution details</p>
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
            <SectionHeading>Account</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Account type" error={fieldErrors.accountType}>
                <select
                  value={form.accountType}
                  onChange={(event) => updateField("accountType", event.target.value)}
                  className={inputClassName}
                  required
                >
                  <option value="">Select account type...</option>
                  {accountTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Provider name" error={fieldErrors.providerName}>
                <input
                  value={form.providerName}
                  onChange={(event) => updateField("providerName", event.target.value)}
                  maxLength={200}
                  placeholder="e.g. AustralianSuper"
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label="Product name">
                <input
                  value={form.productName}
                  onChange={(event) => updateField("productName", event.target.value)}
                  maxLength={200}
                  placeholder="e.g. Balanced Option"
                  className={inputClassName}
                />
              </Field>
              <Field label="Member number">
                <input
                  value={form.memberNumber}
                  onChange={(event) => updateField("memberNumber", event.target.value)}
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>
              <Field label="Investment option">
                <input
                  value={form.investmentOption}
                  onChange={(event) => updateField("investmentOption", event.target.value)}
                  maxLength={200}
                  placeholder="e.g. High Growth"
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Balance & contributions</SectionHeading>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Current balance" error={fieldErrors.currentBalance}>
                <input
                  value={form.currentBalance}
                  onChange={(event) => updateField("currentBalance", event.target.value)}
                  inputMode="decimal"
                  className={inputClassName}
                />
              </Field>
              <Field label="Balance as at">
                <input
                  type="date"
                  value={form.balanceAsAt}
                  onChange={(event) => updateField("balanceAsAt", event.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Contributions YTD" error={fieldErrors.contributionsYtd}>
                <input
                  value={form.contributionsYtd}
                  onChange={(event) => updateField("contributionsYtd", event.target.value)}
                  inputMode="decimal"
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Beneficiary nomination</SectionHeading>
            <Field label="Nomination type">
              <select
                value={form.beneficiaryNominationType}
                onChange={(event) => updateField("beneficiaryNominationType", event.target.value)}
                className={inputClassName}
              >
                <option value="">Not recorded</option>
                {nominationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nomination notes">
              <textarea
                value={form.beneficiaryNominationNotes}
                onChange={(event) => updateField("beneficiaryNominationNotes", event.target.value)}
                maxLength={2000}
                className={textareaClassName}
              />
            </Field>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>Insurance in fund</SectionHeading>
            <Field label="Insurance in fund summary">
              <textarea
                value={form.insuranceInFundSummary}
                onChange={(event) => updateField("insuranceInFundSummary", event.target.value)}
                maxLength={2000}
                placeholder="e.g. Death $500K, TPD $300K, Income protection 75% to age 65"
                className={textareaClassName}
              />
            </Field>
          </section>

          <section className="space-y-3 border-t-[0.5px] border-[#f0f0f0] pt-4">
            <SectionHeading>BPAY</SectionHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="BPAY biller code">
                <input
                  value={form.bpayBillerCode}
                  onChange={(event) => updateField("bpayBillerCode", event.target.value)}
                  maxLength={50}
                  className={inputClassName}
                />
              </Field>
              <Field label="BPAY reference">
                <input
                  value={form.bpayReference}
                  onChange={(event) => updateField("bpayReference", event.target.value)}
                  maxLength={100}
                  className={inputClassName}
                />
              </Field>
            </div>
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
