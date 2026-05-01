"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"

type MeetingType = "in_person" | "video" | "phone"

type QuickAddMeetingModalProps = {
  partyId: string
  clientDisplayName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type FieldErrors = {
  otherParties?: string
  title?: string
  body?: string
}

const meetingTypeOptions: { label: string; value: MeetingType }[] = [
  { label: "In-person", value: "in_person" },
  { label: "Video", value: "video" },
  { label: "Phone", value: "phone" },
]

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238]"

function fieldLabel(label: string) {
  return <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">{label}</span>
}

function errorText(message: string | undefined) {
  return message ? <p className="text-[11px] text-[#B42318]">{message}</p> : null
}

export default function QuickAddMeetingModal({
  partyId,
  clientDisplayName,
  isOpen,
  onClose,
  onSuccess,
}: QuickAddMeetingModalProps) {
  const [meetingType, setMeetingType] = useState<MeetingType>("in_person")
  const [otherParties, setOtherParties] = useState(clientDisplayName)
  const [title, setTitle] = useState(`In-person meeting with ${clientDisplayName}`)
  const [titleTouched, setTitleTouched] = useState(false)
  const [body, setBody] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedMeetingTypeLabel = useMemo(
    () => meetingTypeOptions.find((option) => option.value === meetingType)?.label ?? "In-person",
    [meetingType],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setMeetingType("in_person")
    setOtherParties(clientDisplayName)
    setTitle(`In-person meeting with ${clientDisplayName}`)
    setTitleTouched(false)
    setBody("")
    setErrors({})
    setServerError(null)
  }, [clientDisplayName, isOpen])

  useEffect(() => {
    if (!titleTouched) {
      setTitle(`${selectedMeetingTypeLabel} meeting with ${otherParties || clientDisplayName}`)
    }
  }, [clientDisplayName, otherParties, selectedMeetingTypeLabel, titleTouched])

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
    const trimmedOtherParties = otherParties.trim()
    const trimmedTitle = title.trim()

    if (!trimmedOtherParties) {
      nextErrors.otherParties = "Other parties is required."
    } else if (trimmedOtherParties.length > 200) {
      nextErrors.otherParties = "Other parties must be 200 characters or fewer."
    }

    if (!trimmedTitle) {
      nextErrors.title = "Title is required."
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = "Title must be 200 characters or fewer."
    }

    if (body.length > 50000) {
      nextErrors.body = "Body must be 50000 characters or fewer."
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

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/timeline-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "meeting",
          party_id: partyId,
          title: title.trim(),
          ...(body.trim() ? { body: body.trim() } : {}),
          source: "native",
          metadata: {
            type: meetingType,
            other_parties: otherParties.trim(),
          },
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (response.status !== 201) {
        throw new Error(payload.error ?? "Failed to add meeting")
      }

      onSuccess()
      onClose()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to add meeting")
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
            <h2 className="text-[17px] font-semibold text-[#113238]">Add Meeting</h2>
            <p className="text-[12px] text-[#6b7280]">Record a meeting for {clientDisplayName}.</p>
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

        <div className="grid gap-3">
          <label className="space-y-1">
            {fieldLabel("Type")}
            <select
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value as MeetingType)}
              className={inputClassName}
              disabled={isSubmitting}
            >
              {meetingTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            {fieldLabel("Other parties")}
            <input
              value={otherParties}
              maxLength={200}
              onChange={(event) => setOtherParties(event.target.value)}
              className={inputClassName}
              disabled={isSubmitting}
              required
            />
            {errorText(errors.otherParties)}
          </label>

          <label className="space-y-1">
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

          <label className="space-y-1">
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
            {isSubmitting ? "Saving..." : "Save Meeting"}
          </button>
        </div>
      </form>
    </div>
  )
}
