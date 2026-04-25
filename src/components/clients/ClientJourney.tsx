"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { getLifecycleStageClasses } from "@/components/clients/ClientList"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type {
  ClientJourneyResponse,
  JourneyCurrentInstance,
  JourneyOutcomeCatalogEntry,
  JourneyPhaseTarget,
  LifecycleStage,
  ServiceSegment,
} from "@/types/journey"

type ClientJourneyProps = {
  clientId: string
  clientScope: "party" | "household"
  clientDisplayName: string
  onMutation?: () => void
}

const SERVICE_SEGMENT_OPTIONS: Array<{ label: string; value: ServiceSegment | null }> = [
  { label: "Not set", value: null },
  { label: "Transaction", value: "transaction" },
  { label: "Cashflow Manager", value: "cashflow" },
  { label: "Wealth Manager", value: "wealth" },
  { label: "Wealth Manager+", value: "wealth_plus" },
]

const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  prospect: "Prospect",
  engagement: "Engagement",
  advice: "Advice",
  implementation: "Implementation",
  client: "Client",
  lost: "Lost",
  ceased: "Ceased",
}

const PHASE_KEY_TO_STAGE: Record<string, LifecycleStage> = {
  initial_contact: "prospect",
  engagement: "engagement",
  advice: "advice",
  implementation: "implementation",
  closing: "lost",
}

const NOT_PROCEEDING_OUTCOME: JourneyOutcomeCatalogEntry = {
  outcomeKey: "not_proceeding",
  outcomeLabel: "Not Proceeding - prospect declined to proceed",
  sortOrder: 5,
  isTerminalLost: true,
  nextPhaseKey: null,
  setsWorkflowStatus: null,
}

function formatStageLabel(stage: LifecycleStage | null) {
  if (!stage) {
    return "Not set"
  }

  return LIFECYCLE_STAGE_LABELS[stage]
}

function formatServiceSegmentLabel(segment: ServiceSegment | null) {
  if (!segment) {
    return "Not set"
  }

  if (segment === "wealth_plus") {
    return "Wealth Manager+"
  }

  return segment
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed)
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown time"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function getTargetStageFromPhase(target: JourneyPhaseTarget | null, fallback: LifecycleStage): LifecycleStage {
  if (!target) {
    return fallback
  }

  return PHASE_KEY_TO_STAGE[target.key] ?? fallback
}

function getOutcomeEffectSummary(
  outcome: JourneyOutcomeCatalogEntry | null,
  phaseTargets: JourneyPhaseTarget[],
) {
  if (!outcome) {
    return "record this outcome"
  }

  if (outcome.outcomeKey === "no_answer") {
    return "send the no-answer email + SMS templates and increment the retry counter"
  }

  if (outcome.isTerminalLost) {
    return "close this prospect's workflow"
  }

  if (outcome.setsWorkflowStatus === "paused") {
    return "pause the workflow until you resume"
  }

  if (outcome.nextPhaseKey) {
    const target = phaseTargets.find((entry) => entry.key === outcome.nextPhaseKey)
    return `advance to ${target?.name ?? outcome.nextPhaseKey}`
  }

  return "record this outcome"
}

function formatDriverActionLabel(value: string | null) {
  if (value === "send_booking_link") {
    return "Booking link sent to client"
  }

  if (value === "book_in_calendly") {
    return "Adviser will book in Calendly"
  }

  return "Driver action recorded"
}

function JourneyPastPhases({
  entries,
}: {
  entries: ClientJourneyResponse["pastInstances"]
}) {
  if (entries.length === 0) {
    return null
  }

  return (
    <div className="mt-3 rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.04em] text-[#9ca3af]">Past phases</p>
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const isCancelled = entry.status === "cancelled"
          return (
            <p
              key={entry.id}
              className={`text-[12px] ${isCancelled ? "text-[#6b7280] line-through" : "text-[#4b5563]"}`}
            >
              {isCancelled ? "x" : "done"} {entry.template.name} -{" "}
              {isCancelled ? "Cancelled" : "Completed"} {formatDate(entry.completedAt ?? entry.createdAt)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

export default function ClientJourney({
  clientId,
  clientScope,
  clientDisplayName,
  onMutation,
}: ClientJourneyProps) {
  const [journey, setJourney] = useState<ClientJourneyResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false)
  const [skipTarget, setSkipTarget] = useState<JourneyPhaseTarget | null>(null)
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false)
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false)
  const [selectedOutcomeKey, setSelectedOutcomeKey] = useState("")
  const [outcomeConfirmKey, setOutcomeConfirmKey] = useState<string | null>(null)
  const [segmentStatus, setSegmentStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const loadJourney = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/journey`)
      if (!response.ok) {
        throw new Error("Failed to load journey")
      }

      const payload = (await response.json()) as ClientJourneyResponse
      setJourney(payload)
    } catch (loadError) {
      console.error(loadError)
      setError("Unable to load journey.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadJourney()
  }, [loadJourney])

  useEffect(() => {
    if (segmentStatus !== "saved" && segmentStatus !== "error") {
      return
    }

    const timer = window.setTimeout(() => {
      setSegmentStatus("idle")
    }, 1600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [segmentStatus])

  const current = journey?.currentInstance ?? null
  const lifecycleStage = journey?.lifecycleStage ?? null
  const serviceSegment = journey?.serviceSegment ?? null
  const isTerminal = lifecycleStage === "lost" || lifecycleStage === "ceased"
  const hasCurrent = Boolean(current)
  const noData =
    !hasCurrent &&
    lifecycleStage === null &&
    (journey?.pastInstances.length ?? 0) === 0 &&
    (journey?.triggerInstances.length ?? 0) === 0
  const showServiceSegmentEditor = lifecycleStage === "client" && !isTerminal
  const usesDecisionCard = current?.template.key === "initial_contact" && current.decisionState !== null
  const outcomeCatalog = useMemo(() => current?.outcomeCatalog ?? [], [current])
  const selectedOutcome = outcomeCatalog.find((outcome) => outcome.outcomeKey === selectedOutcomeKey) ?? null
  const outcomeToConfirm =
    outcomeConfirmKey === "not_proceeding"
      ? outcomeCatalog.find((outcome) => outcome.outcomeKey === outcomeConfirmKey) ?? NOT_PROCEEDING_OUTCOME
      : outcomeCatalog.find((outcome) => outcome.outcomeKey === outcomeConfirmKey) ?? null

  const incompleteCount = current ? Math.max(current.taskSummary.total - current.taskSummary.done, 0) : 0
  const readyToAdvance = current?.taskSummary.allComplete ?? false
  const progressPercent = current
    ? current.taskSummary.total > 0
      ? Math.round((current.taskSummary.done / current.taskSummary.total) * 100)
      : 0
    : 0

  const nextStage = useMemo(() => {
    if (!journey) {
      return "client" as LifecycleStage
    }

    return getTargetStageFromPhase(journey.nextPhaseTemplate, "client")
  }, [journey])

  const skippedPhases = useMemo(() => {
    if (!journey || !current || !skipTarget) {
      return []
    }

    return journey.availableSkipTargets.filter(
      (target) =>
        target.phaseOrder > (current.template.phaseOrder ?? 0) &&
        target.phaseOrder < skipTarget.phaseOrder,
    )
  }, [current, journey, skipTarget])

  const terminalEventDate = useMemo(() => {
    if (!journey || !isTerminal) {
      return null
    }

    const closing = [...journey.triggerInstances]
      .filter((entry) => entry.template.key === "closing")
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]

    return closing?.completedAt ?? closing?.createdAt ?? journey.lifecycleStageUpdatedAt
  }, [isTerminal, journey])

  useEffect(() => {
    if (!current || current.decisionState !== "ready_for_outcome" || outcomeCatalog.length === 0) {
      setSelectedOutcomeKey("")
      return
    }

    setSelectedOutcomeKey((currentKey) =>
      currentKey && outcomeCatalog.some((outcome) => outcome.outcomeKey === currentKey)
        ? currentKey
        : outcomeCatalog[0]?.outcomeKey ?? "",
    )
  }, [current, outcomeCatalog])

  async function runAdvance(target: JourneyPhaseTarget | null) {
    if (!current) {
      return
    }

    setIsMutating(true)
    try {
      const response = await fetch(`/api/engagements/${current.engagementId}/advance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: target ? JSON.stringify({ targetPhaseKey: target.key }) : "",
      })

      if (!response.ok) {
        throw new Error("Failed to advance journey")
      }

      await loadJourney()
      onMutation?.()
    } catch (mutationError) {
      console.error(mutationError)
      setError("Unable to update journey.")
    } finally {
      setIsMutating(false)
      setIsAdvanceDialogOpen(false)
      setIsSkipDialogOpen(false)
      setSkipTarget(null)
    }
  }

  async function runStop() {
    if (!journey) {
      return
    }

    const engagementId = current?.engagementId ?? journey.mostRecentEngagementId
    if (!engagementId) {
      return
    }

    setIsMutating(true)
    try {
      const response = await fetch(`/api/engagements/${engagementId}/stop`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to stop journey")
      }

      await loadJourney()
      onMutation?.()
    } catch (mutationError) {
      console.error(mutationError)
      setError("Unable to update journey.")
    } finally {
      setIsMutating(false)
      setIsStopDialogOpen(false)
    }
  }

  async function runWorkflowInstanceOutcome(outcomeKey: string) {
    if (!current) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const response = await fetch(`/api/workflow-instances/${current.id}/outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outcomeKey }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to record outcome")
      }

      await loadJourney()
      onMutation?.()
    } catch (mutationError) {
      console.error(mutationError)
      setError(mutationError instanceof Error ? mutationError.message : "Unable to record outcome.")
    } finally {
      setIsMutating(false)
      setOutcomeConfirmKey(null)
    }
  }

  async function runDriverAction(actionKey: "send_booking_link" | "book_in_calendly") {
    if (!current) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const response = await fetch(`/api/workflow-instances/${current.id}/driver-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ actionKey }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to record driver action")
      }

      await loadJourney()
      onMutation?.()
    } catch (mutationError) {
      console.error(mutationError)
      setError(mutationError instanceof Error ? mutationError.message : "Unable to record driver action.")
    } finally {
      setIsMutating(false)
    }
  }

  async function runResumeWorkflowInstance() {
    if (!current) {
      return
    }

    setIsMutating(true)
    setError(null)

    try {
      const response = await fetch(`/api/workflow-instances/${current.id}/resume`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to resume workflow")
      }

      await loadJourney()
      onMutation?.()
    } catch (mutationError) {
      console.error(mutationError)
      setError(mutationError instanceof Error ? mutationError.message : "Unable to resume workflow.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleServiceSegmentChange(nextValue: ServiceSegment | null) {
    setSegmentStatus("saving")

    try {
      const response = await fetch(`/api/clients/${clientId}/classification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceTier: nextValue }),
      })

      if (!response.ok) {
        throw new Error("Failed to update service segment")
      }

      setJourney((currentJourney) =>
        currentJourney
          ? {
              ...currentJourney,
              serviceSegment: nextValue,
            }
          : currentJourney,
      )
      setSegmentStatus("saved")
    } catch (segmentError) {
      console.error(segmentError)
      setSegmentStatus("error")
    }
  }

  function renderDecisionCard(currentInstance: JourneyCurrentInstance) {
    if (currentInstance.decisionState === "awaiting_event") {
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-semibold text-[#113238]">{currentInstance.template.name}</p>
            <span className="inline-flex rounded-[999px] border border-[#dbe3ea] bg-[#F6F9FC] px-2 py-0.5 text-[10px] font-medium text-[#4b5563]">
              Awaiting event
            </span>
          </div>
          <p className="mt-2 text-[13px] text-[#4b5563]">
            Awaiting 15 min call on {formatDateTime(currentInstance.awaitingEventEndsAt)}
          </p>
        </>
      )
    }

    if (currentInstance.decisionState === "ready_for_outcome") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-semibold text-[#113238]">{currentInstance.template.name}</p>
            <span className="inline-flex rounded-[999px] border border-amber-500 bg-white px-2 py-0.5 text-[10px] font-medium text-[#92400e]">
              What happened?
            </span>
          </div>

          <div className="rounded-[8px] border-[0.5px] border-[#e5e7eb] border-l-4 border-l-amber-500 bg-[#FFFBEB] p-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#113238]">
              Record outcome
            </p>
            <p className="mt-1 text-[11px] text-[#6b7280]">Choose the outcome from the Initial Contact.</p>

            {outcomeCatalog.length > 0 ? (
              <>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <select
                    value={selectedOutcomeKey}
                    onChange={(event) => setSelectedOutcomeKey(event.target.value)}
                    disabled={isMutating}
                    className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#113238] disabled:opacity-60"
                  >
                    {outcomeCatalog.map((outcome) => (
                      <option key={outcome.outcomeKey} value={outcome.outcomeKey}>
                        {outcome.outcomeLabel}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setOutcomeConfirmKey(selectedOutcome?.outcomeKey ?? null)}
                    disabled={isMutating || !selectedOutcome}
                    className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
                  >
                    Set outcome
                  </button>
                </div>

                {selectedOutcome ? (
                  <p className="mt-2 text-[11px] text-[#6b7280]">
                    Effect: {getOutcomeEffectSummary(selectedOutcome, journey?.availableSkipTargets ?? [])}.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-[12px] text-[#9ca3af]">No outcomes available.</p>
            )}
          </div>
        </div>
      )
    }

    if (currentInstance.decisionState === "driving_booking") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-semibold text-[#113238]">{currentInstance.template.name}</p>
            <span className="inline-flex rounded-[999px] border border-[#A7E3B5] bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]">
              Driving booking
            </span>
          </div>
          <p className="text-[12px] text-[#6b7280]">Suitable outcome recorded. Drive the Initial Meeting booking.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runDriverAction("send_booking_link")}
              disabled={isMutating}
              className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
            >
              Send booking link to client
            </button>
            <button
              type="button"
              onClick={() => void runDriverAction("book_in_calendly")}
              disabled={isMutating}
              className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#113238] disabled:opacity-60"
            >
              I&apos;ll book in Calendly myself
            </button>
          </div>
          {currentInstance.lastDriverActionKey ? (
            <p className="text-[11px] text-[#6b7280]">
              {formatDriverActionLabel(currentInstance.lastDriverActionKey)}
              {currentInstance.lastDriverActionAt ? ` - ${formatDateTime(currentInstance.lastDriverActionAt)}` : ""}
            </p>
          ) : null}
        </div>
      )
    }

    if (currentInstance.decisionState === "paused") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[18px] font-semibold text-[#113238]">{currentInstance.template.name}</p>
            <span className="inline-flex rounded-[999px] border border-[#fbbf24] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#92400e]">
              On Hold
            </span>
          </div>
          <p className="text-[12px] text-[#6b7280]">Workflow is paused until the adviser resumes or closes it.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runResumeWorkflowInstance()}
              disabled={isMutating}
              className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => setOutcomeConfirmKey("not_proceeding")}
              disabled={isMutating}
              className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#7f1d1d] disabled:opacity-60"
            >
              Not Proceeding
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  if (isLoading) {
    return (
      <div className="mb-3 rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-3">
        <p className="text-[12px] text-[#9ca3af]">Loading journey...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-3 rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-[#6b7280]">{error}</p>
          <button
            type="button"
            onClick={() => void loadJourney()}
            className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px] text-[#113238]"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!journey) {
    return null
  }

  return (
    <>
      <div className="mb-3 rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-[12px] uppercase tracking-[0.05em] text-[#9ca3af]">Client journey ({clientScope})</p>
          <span
            className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${
              getLifecycleStageClasses(lifecycleStage ?? "")
            }`}
          >
            {lifecycleStage ? `Journey - ${formatStageLabel(lifecycleStage)}` : "Journey - Not started"}
          </span>
        </div>

        {hasCurrent && current ? (
          usesDecisionCard ? (
            renderDecisionCard(current)
          ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[18px] font-semibold text-[#113238]">{current.template.name}</p>
              {readyToAdvance ? (
                <span
                  aria-label="Current phase tasks are complete - ready to advance"
                  className="inline-flex rounded-[999px] border border-[#A7E3B5] bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-medium text-[#2E7D32]"
                >
                  Ready to advance
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              {current.taskSummary.done} of {current.taskSummary.total} tasks complete
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-[999px] bg-[#EDF1F4]">
              <div
                className="h-full bg-[#113238] transition-[width] duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdvanceDialogOpen(true)}
                disabled={isMutating}
                className={`rounded-[7px] border-[0.5px] px-3 py-[6px] text-[12px] transition-colors duration-150 ${
                  readyToAdvance
                    ? "border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32] ring-1 ring-[#A7E3B5]"
                    : "border-[#113238] bg-[#113238] text-white"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {journey.nextPhaseTemplate
                  ? `Advance to ${journey.nextPhaseTemplate.name} ->`
                  : "Advance to Client ->"}
              </button>

              {journey.availableSkipTargets.length > 0 ? (
                <select
                  value=""
                  onChange={(event) => {
                    const target = journey.availableSkipTargets.find(
                      (entry) => entry.key === event.target.value,
                    )
                    if (target) {
                      setSkipTarget(target)
                      setIsSkipDialogOpen(true)
                    }
                  }}
                  disabled={isMutating}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] text-[#113238] disabled:opacity-60"
                >
                  <option value="">Skip to...</option>
                  {journey.availableSkipTargets.map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                onClick={() => setIsStopDialogOpen(true)}
                disabled={isMutating}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] text-[#7f1d1d] disabled:opacity-60"
              >
                Client not proceeding
              </button>
            </div>
          </>
          )
        ) : isTerminal ? (
          <p className="text-[13px] text-[#6b7280]">
            Journey ended on {formatDate(terminalEventDate)} - marked as {formatStageLabel(lifecycleStage)}.
          </p>
        ) : lifecycleStage ? (
          <>
            <p className="text-[13px] text-[#6b7280]">No active workflow in progress.</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStopDialogOpen(true)}
                disabled={isMutating || !journey.mostRecentEngagementId}
                title={
                  journey.mostRecentEngagementId
                    ? undefined
                    : "No engagement to stop - contact Claude for cleanup"
                }
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] text-[#7f1d1d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Client not proceeding
              </button>
            </div>
          </>
        ) : noData ? (
          <p className="text-[13px] text-[#6b7280]">No journey tracking yet.</p>
        ) : (
          <p className="text-[13px] text-[#6b7280]">No active workflow in progress.</p>
        )}

        {showServiceSegmentEditor ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-[#6b7280]" htmlFor="service-segment-select">
              Service segment
            </label>
            <select
              id="service-segment-select"
              value={serviceSegment ?? ""}
              onChange={(event) => {
                const selected = event.target.value || null
                void handleServiceSegmentChange(selected as ServiceSegment | null)
              }}
              disabled={segmentStatus === "saving"}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px] text-[#113238] disabled:opacity-60"
            >
              {SERVICE_SEGMENT_OPTIONS.map((option) => (
                <option key={option.value ?? "none"} value={option.value ?? ""}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[#9ca3af]">
              {segmentStatus === "saving"
                ? "Saving..."
                : segmentStatus === "saved"
                  ? "Saved"
                  : segmentStatus === "error"
                    ? "Update failed"
                    : formatServiceSegmentLabel(serviceSegment)}
            </span>
          </div>
        ) : null}

        <JourneyPastPhases entries={journey.pastInstances} />
      </div>

      <AlertDialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance to {journey.nextPhaseTemplate?.name ?? "Client"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {incompleteCount} incomplete tasks will be cancelled. Lifecycle stage will become{" "}
              {formatStageLabel(nextStage)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating}
              className="border-[#113238] bg-[#113238]"
              onClick={(event) => {
                event.preventDefault()
                void runAdvance(null)
              }}
            >
              Advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSkipDialogOpen} onOpenChange={setIsSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip to {skipTarget?.name ?? "selected phase"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {skippedPhases.length > 0
                ? `Skipped phases: ${skippedPhases.map((entry) => entry.name).join(", ")}. `
                : ""}
              {incompleteCount} incomplete tasks in {current?.template.name ?? "current phase"} will be cancelled.
              Lifecycle stage will become{" "}
              {formatStageLabel(getTargetStageFromPhase(skipTarget, lifecycleStage ?? "prospect"))}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating || !skipTarget}
              className="border-[#113238] bg-[#113238]"
              onClick={(event) => {
                event.preventDefault()
                void runAdvance(skipTarget)
              }}
            >
              Skip to {skipTarget?.name ?? "phase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {clientDisplayName} as not proceeding?</AlertDialogTitle>
            <AlertDialogDescription>
              The current workflow will be cancelled and the closing workflow will begin. Lifecycle stage will become{" "}
              {lifecycleStage === "client" ? "Ceased" : "Lost"}. This can be recorded in Mailchimp for ongoing nurture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating || !journey.mostRecentEngagementId}
              onClick={(event) => {
                event.preventDefault()
                void runStop()
              }}
            >
              Mark not proceeding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(outcomeToConfirm)}
        onOpenChange={(open) => {
          if (!open) {
            setOutcomeConfirmKey(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm outcome</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re recording: {outcomeToConfirm?.outcomeLabel ?? "selected outcome"}. This will{" "}
              {getOutcomeEffectSummary(outcomeToConfirm, journey.availableSkipTargets)}. Confirm?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating || !outcomeToConfirm}
              className="border-[#113238] bg-[#113238]"
              onClick={(event) => {
                event.preventDefault()
                if (outcomeToConfirm) {
                  void runWorkflowInstanceOutcome(outcomeToConfirm.outcomeKey)
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
