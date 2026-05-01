"use client"

import { useEffect, useState, type FormEvent } from "react"

type QuickAddPhoneCallModalProps = {
  partyId: string
  clientDisplayName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type FieldErrors = {
  otherParty?: string
  durationMinutes?: string
  title?: string
  body?: string
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"

function fieldLabel(label: string) {
  return <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
}

function errorText(message: string | undefined) {
  return message ? <p className="text-[11px] text-[#B42318]">{message}</p> : null
}

export default function QuickAddPhoneCallModal({
  partyId,
  clientDisplayName,
  isOpen,
  onClose,
  onSuccess,
}: QuickAddPhoneCallModalProps) {
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound")
  const [otherParty, setOtherParty] = useState(clientDisplayName)
  const [durationMinutes, setDurationMinutes] = useState("")
  const [title, setTitle] = useState(`Call with ${clientDisplayName}`)
  const [titleTouched, setTitleTouched] = useState(false)
  const [body, setBody] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDirection("outbound")
    setOtherParty(clientDisplayName)
    setDurationMinutes("")
    setTitle(`Call with ${clientDisplayName}`)
    setTitleTouched(false)
    setBody("")
    setErrors({})
    setServerError(null)
  }, [clientDisplayName, isOpen])

  useEffect(() => {
    if (!titleTouched) {
      setTitle(`Call with ${otherParty || clientDisplayName}`)
    }
  }, [clientDisplayName, otherParty, titleTouched])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  function validate() {
    const nextErrors: FieldErrors = {}
    const trimmedOtherParty = otherParty.trim()
    const trimmedTitle = title.trim()

    if (!trimmedOtherParty) {
      nextErrors.otherParty = "Other party is required."
    } else if (trimmedOtherParty.length > 200) {
      nextErrors.otherParty = "Other party must be 200 characters or fewer."
    }

    if (!trimmedTitle) {
      nextErrors.title = "Title is required."
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = "Title must be 200 characters or fewer."
    }

    if (body.length > 50000) {
      nextErrors.body = "Body must be 50000 characters or fewer."
    }

    if (durationMinutes.trim()) {
      const parsedDuration = Number(durationMinutes)
      if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
        nextErrors.durationMinutes = "Duration must be zero or more minutes."
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)

    if (!validate()) {
      return
    }

    const parsedDuration = durationMinutes.trim() ? Number(durationMinutes) : null
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/timeline-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "phone_call",
          party_id: partyId,
          title: title.trim(),
          ...(body.trim() ? { body: body.trim() } : {}),
          source: "native",
          metadata: {
            direction,
            other_party: otherParty.trim(),
            duration_minutes: parsedDuration,
          },
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (response.status !== 201) {
        throw new Error(payload.error ?? "Failed to add phone call")
      }

      onSuccess()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to add phone call")
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
      onClick={() => {
        if (!isSubmitting) {
          onClose()
        }
      }}
    >
      <form
        className="max-h-[95vh] w-full max-w-[560px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#113238]">Add Phone Call</h2>
            <p className="text-[12px] text-[#6b7280]">Record a call for {clientDisplayName}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[6px] border-[0.5px] border-[#e5e7eb] px-2 py-1 text-[12px] text-[#113238] disabled:opacity-60"
          >
            Close
          </button>
        </div>

        {serverError ? (
          <div className="mb-4 rounded-[8px] border-[0.5px] border-[#f9caca] bg-[#FFF7F7] px-3 py-2 text-[12px] text-[#B42318]">
            {serverError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            {fieldLabel("Direction")}
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as "outbound" | "inbound")}
              className={inputClassName}
              disabled={isSubmitting}
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </label>

          <label className="space-y-1">
            {fieldLabel("Duration (minutes)")}
            <input
              type="number"
              min="0"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              className={inputClassName}
              disabled={isSubmitting}
            />
            {errorText(errors.durationMinutes)}
          </label>

          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Other party")}
            <input
              value={otherParty}
              maxLength={200}
              onChange={(event) => setOtherParty(event.target.value)}
              className={inputClassName}
              disabled={isSubmitting}
              required
            />
            {errorText(errors.otherParty)}
          </label>

          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Title")}
            <input
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitleTouched(true)
                setTitle(event.target.value)
              }}
              className={inputClassName}
              disabled={isSubmitting}
              required
            />
            {errorText(errors.title)}
          </label>

          <label className="space-y-1 md:col-span-2">
            {fieldLabel("Body")}
            <textarea
              value={body}
              maxLength={50000}
              onChange={(event) => setBody(event.target.value)}
              className={`${inputClassName} min-h-[130px]`}
              disabled={isSubmitting}
            />
            {errorText(errors.body)}
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[6px] text-[12px] text-[#113238] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[6px] text-[12px] text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Phone Call"}
          </button>
        </div>
      </form>
    </div>
  )
}
