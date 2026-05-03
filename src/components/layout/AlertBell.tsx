"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type RecentAlert = {
  id: string
  occurred_at: string
  summary: string
  href: string
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return ""
  }

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

export default function AlertBell() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [alerts, setAlerts] = useState<RecentAlert[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts/unread-count", { cache: "no-store" })
      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as { count?: number }
      setCount(typeof payload.count === "number" ? payload.count : 0)
    } catch {
      // The bell is advisory UI; transient polling failures should stay quiet.
    }
  }, [])

  const loadAlerts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/alerts/recent", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load alerts")
      }

      const payload = (await response.json()) as { alerts?: RecentAlert[] }
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load alerts")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCount()
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCount()
      }
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [loadCount])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  async function toggleOpen() {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
    if (nextOpen) {
      await loadAlerts()
      await loadCount()
    }
  }

  async function markAllRead() {
    setError(null)

    try {
      const response = await fetch("/api/alerts/mark-all-read", { method: "POST" })
      if (!response.ok) {
        throw new Error("Failed to mark alerts as read")
      }

      setAlerts([])
      setCount(0)
      setIsOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to mark alerts as read")
    }
  }

  function openAlert(alert: RecentAlert) {
    setIsOpen(false)
    router.push(alert.href)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        title="Alerts"
        aria-label={count > 0 ? `${count} unread alerts` : "No unread alerts"}
        className="relative flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#e5e7eb] text-[#4b5563] hover:bg-[#F2F4F6]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#b91c1c] px-1 text-[10px] font-semibold leading-4 text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-50 w-[320px] overflow-hidden rounded-[8px] border border-[#d9e2e7] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
            <p className="text-[13px] font-semibold text-[#113238]">Alerts</p>
            {count > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-[#185F68] hover:underline"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="border-b border-[#fee2e2] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="px-3 py-8 text-center text-[12px] text-[#6b7280]">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-[#6b7280]">No unread alerts.</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => openAlert(alert)}
                  className="block w-full border-b border-[#edf1f4] px-3 py-3 text-left hover:bg-[#FAFBFC]"
                >
                  <span className="block text-[13px] font-medium text-[#113238]">{alert.summary}</span>
                  <span className="mt-1 block text-[11px] text-[#6b7280]">
                    {formatRelativeTime(alert.occurred_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
