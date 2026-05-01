"use client"

import { useEffect, useState, type FormEvent } from "react"

import type { ClientAddress, ClientDetail } from "@/types/client-record"

type AddressSectionModalProps = {
  clientId: string
  clientDetail: ClientDetail
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const textareaClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] leading-[1.5] text-[#113238] outline-none focus:border-[#113238]"

function formatAddress(address: ClientAddress | null | undefined) {
  if (!address) return ""

  const suburbLine = [address.suburb, address.state, address.postcode].filter(Boolean).join(" ")
  return [address.line1, address.line2, suburbLine, address.country].filter(Boolean).join("\n")
}

function parseAddress(value: string): ClientAddress | null {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return null
  }

  const line1 = lines[0] ?? null
  const line2 = lines.length > 3 ? lines.slice(1, -2).join(", ") : lines.length === 2 ? lines[1] ?? null : null
  const suburbStatePostcode = lines.length >= 3 ? lines[lines.length - 2] ?? "" : ""
  const country = lines.length >= 3 ? lines[lines.length - 1] ?? null : null
  const locationParts = suburbStatePostcode.split(/\s+/).filter(Boolean)
  const postcode = locationParts.length >= 3 ? locationParts[locationParts.length - 1] : null
  const state = locationParts.length >= 3 ? locationParts[locationParts.length - 2] : null
  const suburb =
    locationParts.length >= 3
      ? locationParts.slice(0, -2).join(" ")
      : lines.length >= 3
        ? suburbStatePostcode
        : null

  return {
    line1,
    line2,
    suburb: suburb || null,
    state: state || null,
    postcode: postcode || null,
    country,
  }
}

export default function AddressSectionModal({
  clientId,
  clientDetail,
  isOpen,
  onClose,
  onSaved,
}: AddressSectionModalProps) {
  const [residentialAddress, setResidentialAddress] = useState("")
  const [postalAddress, setPostalAddress] = useState("")
  const [sameAsResidential, setSameAsResidential] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const residential = formatAddress(clientDetail.person?.addressResidential)
    const postal = formatAddress(clientDetail.person?.addressPostal)
    setResidentialAddress(residential)
    setPostalAddress(postal || residential)
    setSameAsResidential(!postal || postal === residential)
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
          addressResidential: parseAddress(residentialAddress),
          addressPostal: sameAsResidential ? parseAddress(residentialAddress) : parseAddress(postalAddress),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update address")
      }

      onSaved()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to update address")
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
            <p className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Address</p>
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

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Residential address</span>
            <textarea
              value={residentialAddress}
              onChange={(event) => {
                setResidentialAddress(event.target.value)
                if (sameAsResidential) {
                  setPostalAddress(event.target.value)
                }
              }}
              rows={5}
              className={textareaClassName}
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[#113238]">
            <input
              type="checkbox"
              checked={sameAsResidential}
              onChange={(event) => {
                setSameAsResidential(event.target.checked)
                if (event.target.checked) {
                  setPostalAddress(residentialAddress)
                }
              }}
            />
            Postal address same as residential
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Postal address</span>
            <textarea
              value={sameAsResidential ? residentialAddress : postalAddress}
              onChange={(event) => setPostalAddress(event.target.value)}
              rows={5}
              disabled={sameAsResidential}
              className={`${textareaClassName} disabled:bg-[#F5F7FA] disabled:text-[#9ca3af]`}
            />
          </label>
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
