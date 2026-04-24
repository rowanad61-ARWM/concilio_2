"use client"

import { useEffect, useMemo, useState } from "react"

type TaskOutcomePickerProps = {
  spawnedTaskId: string
  taskId: string
  onComplete: () => void
  onError?: (message: string) => void
}

type OutcomeCatalogEntry = {
  outcomeKey: string
  outcomeLabel: string
  sortOrder: number
  isTerminalLost: boolean
  nextPhaseKey: string | null
  spawnNextTaskTemplateId: string | null
  setsWorkflowStatus: string | null
  maxAttempts: number | null
}

function getEffectCaption(outcome: OutcomeCatalogEntry | null) {
  if (!outcome) {
    return ""
  }

  if (outcome.isTerminalLost) {
    return "Closes workflow"
  }

  if (outcome.nextPhaseKey) {
    return `Advances to ${outcome.nextPhaseKey}`
  }

  if (outcome.setsWorkflowStatus === "paused") {
    return "Pauses workflow"
  }

  if (outcome.spawnNextTaskTemplateId) {
    return "Creates follow-up task"
  }

  return "Completes this task"
}

export default function TaskOutcomePicker({
  spawnedTaskId,
  taskId,
  onComplete,
  onError,
}: TaskOutcomePickerProps) {
  const [outcomes, setOutcomes] = useState<OutcomeCatalogEntry[]>([])
  const [selectedOutcomeKey, setSelectedOutcomeKey] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadOutcomes() {
      setIsLoading(true)
      setMessage(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}/outcomes`)
        const payload = (await response.json()) as {
          spawnedTaskId?: string | null
          outcomes?: unknown
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load outcomes")
        }

        const rows = Array.isArray(payload.outcomes) ? payload.outcomes : []
        const parsed = rows
          .map((row): OutcomeCatalogEntry | null => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              return null
            }

            const value = row as Record<string, unknown>
            if (typeof value.outcomeKey !== "string" || typeof value.outcomeLabel !== "string") {
              return null
            }

            return {
              outcomeKey: value.outcomeKey,
              outcomeLabel: value.outcomeLabel,
              sortOrder: typeof value.sortOrder === "number" ? value.sortOrder : 0,
              isTerminalLost: value.isTerminalLost === true,
              nextPhaseKey: typeof value.nextPhaseKey === "string" ? value.nextPhaseKey : null,
              spawnNextTaskTemplateId:
                typeof value.spawnNextTaskTemplateId === "string" ? value.spawnNextTaskTemplateId : null,
              setsWorkflowStatus:
                typeof value.setsWorkflowStatus === "string" ? value.setsWorkflowStatus : null,
              maxAttempts: typeof value.maxAttempts === "number" ? value.maxAttempts : null,
            }
          })
          .filter((row): row is OutcomeCatalogEntry => Boolean(row))

        if (!active) {
          return
        }

        if (payload.spawnedTaskId && payload.spawnedTaskId !== spawnedTaskId) {
          setOutcomes([])
          setSelectedOutcomeKey("")
          return
        }

        setOutcomes(parsed)
        setSelectedOutcomeKey((current) => {
          if (current && parsed.some((row) => row.outcomeKey === current)) {
            return current
          }

          return parsed[0]?.outcomeKey ?? ""
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load outcomes"
        if (active) {
          onError?.(errorMessage)
          setOutcomes([])
          setSelectedOutcomeKey("")
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadOutcomes()

    return () => {
      active = false
    }
  }, [onError, spawnedTaskId, taskId])

  const selectedOutcome = useMemo(
    () => outcomes.find((item) => item.outcomeKey === selectedOutcomeKey) ?? null,
    [outcomes, selectedOutcomeKey],
  )

  async function confirmSetOutcome() {
    if (!selectedOutcome) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/tasks/${taskId}/outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outcomeKey: selectedOutcome.outcomeKey }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to set outcome")
      }

      setShowConfirm(false)
      onComplete()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set outcome"
      onError?.(errorMessage)
      setMessage(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || outcomes.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#113238]">Task outcome</h3>
      <p className="text-[11px] text-[#6b7280]">Choose an outcome to continue this workflow.</p>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <select
          value={selectedOutcomeKey}
          onChange={(event) => setSelectedOutcomeKey(event.target.value)}
          className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
        >
          {outcomes.map((outcome) => (
            <option key={outcome.outcomeKey} value={outcome.outcomeKey}>
              {outcome.outcomeLabel}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!selectedOutcome}
          className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
        >
          Set outcome
        </button>
      </div>

      {selectedOutcome ? (
        <p className="text-[11px] text-[#6b7280]">Effect: {getEffectCaption(selectedOutcome)}</p>
      ) : null}

      {message ? <p className="text-[11px] text-[#E24B4A]">{message}</p> : null}

      {showConfirm ? (
        <div className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-[#F9FAFB] p-3">
          <p className="text-[12px] text-[#113238]">
            Confirm outcome: <span className="font-semibold">{selectedOutcome?.outcomeLabel}</span>?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] text-[#113238] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmSetOutcome()}
              disabled={isSubmitting}
              className="rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-1.5 text-[12px] text-white disabled:opacity-60"
            >
              {isSubmitting ? "Setting..." : "Confirm"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
