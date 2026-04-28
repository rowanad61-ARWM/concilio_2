"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type AlertAcknowledgeButtonProps = {
  alertId: string
}

export default function AlertAcknowledgeButton({
  alertId,
}: AlertAcknowledgeButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function acknowledgeAlert() {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? "Failed to acknowledge alert")
      }

      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to acknowledge alert")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={acknowledgeAlert}
        disabled={isSubmitting}
        className="h-8 rounded-[7px] border border-[#185F68] px-3 text-[12px] font-semibold text-[#185F68] hover:bg-[#EAF0F1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving" : "Acknowledge"}
      </button>
      {error ? <p className="max-w-[160px] text-right text-[11px] text-[#b91c1c]">{error}</p> : null}
    </div>
  )
}
