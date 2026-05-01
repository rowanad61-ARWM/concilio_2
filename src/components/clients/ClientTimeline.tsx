"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { humanEntityName } from "@/lib/timeline-display"

type TimelineKind =
  | "email_in"
  | "email_out"
  | "sms_in"
  | "sms_out"
  | "phone_call"
  | "meeting"
  | "file_note"
  | "document"
  | "portal_message"
  | "workflow_event"
  | "alert"
  | "task"
  | "system"

type TimelineFilterValue =
  | "all"
  | "emails"
  | "calls"
  | "meetings"
  | "notes"
  | "tasks"
  | "documents"
  | "workflow"
  | "alerts"
  | "system"

type TimelineEntry = {
  id: string
  party_id: string
  household_id: string | null
  kind: TimelineKind
  source: "native" | "xplan" | "manual_import" | string
  external_ref: string | null
  external_designation: string | null
  title: string
  body: string | null
  actor_user_id: string | null
  actor_name: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  occurred_at: string
  inserted_at: string
  updated_at: string
  metadata: Record<string, unknown> | null
}

type TimelineAttachment = {
  id: string
  timeline_entry_id: string
  document_id: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  inserted_at: string
}

type TimelineEntryDetail = TimelineEntry & {
  attachments: TimelineAttachment[]
}

type TimelineListResponse = {
  entries?: unknown[]
  nextCursor?: unknown
}

type DetailResponse = TimelineEntry & {
  attachments?: TimelineAttachment[]
}

const filters: { label: string; value: TimelineFilterValue; kinds: TimelineKind[] | null }[] = [
  { label: "All", value: "all", kinds: null },
  { label: "Emails", value: "emails", kinds: ["email_in", "email_out"] },
  { label: "Calls", value: "calls", kinds: ["phone_call"] },
  { label: "Meetings", value: "meetings", kinds: ["meeting"] },
  { label: "Notes", value: "notes", kinds: ["file_note"] },
  { label: "Tasks", value: "tasks", kinds: ["task"] },
  { label: "Documents", value: "documents", kinds: ["document"] },
  { label: "Workflow", value: "workflow", kinds: ["workflow_event"] },
  { label: "Alerts", value: "alerts", kinds: ["alert"] },
  { label: "System", value: "system", kinds: ["system", "sms_in", "sms_out", "portal_message"] },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTimelineEntry(value: unknown): value is TimelineEntry {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === "string" &&
    typeof value.party_id === "string" &&
    typeof value.kind === "string" &&
    typeof value.source === "string" &&
    typeof value.title === "string" &&
    typeof value.occurred_at === "string"
  )
}

function isTimelineAttachment(value: unknown): value is TimelineAttachment {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === "string" &&
    typeof value.timeline_entry_id === "string" &&
    typeof value.filename === "string"
  )
}

function formatRelativeDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time"
  }

  const diffMs = parsed.getTime() - Date.now()
  const diffAbsMs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (diffAbsMs < 60_000) {
    return "just now"
  }

  const minutes = Math.round(diffMs / 60_000)
  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, "minute")
  }

  const hours = Math.round(diffMs / 3_600_000)
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, "hour")
  }

  const days = Math.round(diffMs / 86_400_000)
  if (Math.abs(days) < 31) {
    return rtf.format(days, "day")
  }

  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) {
    return rtf.format(months, "month")
  }

  return rtf.format(Math.round(days / 365), "year")
}

function formatExactDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function monthLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown month"
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
  }).format(parsed)
}

function formatBytes(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Size unknown"
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatKind(value: string) {
  return value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

function actorLabel(entry: TimelineEntry) {
  if (typeof entry.actor_name === "string" && entry.actor_name.trim()) {
    return entry.actor_name.trim()
  }

  const metadataActor = entry.metadata?.actor_name
  if (typeof metadataActor === "string" && metadataActor.trim()) {
    return metadataActor.trim()
  }

  return entry.actor_user_id ? "Staff user" : "System"
}

function textFromBody(value: string | null) {
  if (!value) {
    return ""
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function metadataRows(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return []
  }

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const rendered =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value)

      return [formatKind(key), rendered] as const
    })
}

function groupEntriesByMonth(entries: TimelineEntry[]) {
  return entries.reduce<{ label: string; entries: TimelineEntry[] }[]>((groups, entry) => {
    const label = monthLabel(entry.occurred_at)
    const currentGroup = groups[groups.length - 1]

    if (currentGroup?.label === label) {
      currentGroup.entries.push(entry)
      return groups
    }

    groups.push({ label, entries: [entry] })
    return groups
  }, [])
}

function IconFrame({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: "orange" | "blue" | "green" | "red" | "grey" | "amber"
}) {
  const classes = {
    orange: "bg-[#FEF0E7] text-[#C45F1A]",
    blue: "bg-[#E6F1FB] text-[#185FA5]",
    green: "bg-[#E6F0EC] text-[#0F5C3A]",
    red: "bg-[#FCE8E8] text-[#B42318]",
    grey: "bg-[#EAF0F1] text-[#113238]",
    amber: "bg-[#FFFBEB] text-[#92400E]",
  }[tone]

  return (
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] ${classes}`}>
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        {children}
      </svg>
    </div>
  )
}

function TimelineKindIcon({ kind }: { kind: TimelineKind }) {
  if (kind === "email_in" || kind === "email_out") {
    return (
      <IconFrame tone="grey">
        <path
          d="M2.5 4.5h11A1.5 1.5 0 0 1 15 6v4A1.5 1.5 0 0 1 13.5 11.5h-11A1.5 1.5 0 0 1 1 10V6a1.5 1.5 0 0 1 1.5-1.5zm0 0L8 8.5l5.5-4"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "task") {
    return (
      <IconFrame tone="green">
        <path
          d="M4 3.5h8M4 7.5h8M4 11.5h5M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "file_note") {
    return (
      <IconFrame tone="orange">
        <path
          d="M5 2.5h4l2 2v7A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-7A1.5 1.5 0 0 1 5.5 3H9m0-.5V5h2.5M6 8h4M6 10.5h3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "workflow_event") {
    return (
      <IconFrame tone="blue">
        <path
          d="M3.5 4.5h9m-9 3h9m-9 3h5m-7-7.5A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "phone_call") {
    return (
      <IconFrame tone="blue">
        <path
          d="M5.2 2.5 6.4 5c.2.4.1.9-.2 1.2l-.7.7a8 8 0 0 0 3.6 3.6l.7-.7c.3-.3.8-.4 1.2-.2l2.5 1.2c.5.2.8.7.7 1.2l-.2 1.2c-.1.5-.5.8-1 .8A11 11 0 0 1 2 3c0-.5.3-.9.8-1l1.2-.2c.5-.1 1 .2 1.2.7Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "meeting") {
    return (
      <IconFrame tone="blue">
        <path
          d="M3.5 3.5h9A1.5 1.5 0 0 1 14 5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V5a1.5 1.5 0 0 1 1.5-1.5Zm.5 3h8M5.5 2.5v2m5-2v2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "document") {
    return (
      <IconFrame tone="grey">
        <path
          d="M5 2.5h4.5L12.5 5v8.5h-9v-11H5Zm4.5 0V5h3M5.5 8h5M5.5 10.5h5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  if (kind === "alert") {
    return (
      <IconFrame tone="red">
        <path
          d="M8 2.5 14 13H2L8 2.5Zm0 3.5v3.2M8 11.5h.01"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </IconFrame>
    )
  }

  return (
    <IconFrame tone="amber">
      <path
        d="M8 2.5v11M2.5 8h11M4.1 4.1l7.8 7.8m0-7.8-7.8 7.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  )
}

function TimelineExpansion({
  entry,
  detail,
  isLoadingDetail,
  onViewFull,
  showViewFull = true,
}: {
  entry: TimelineEntry
  detail: TimelineEntryDetail | null
  isLoadingDetail: boolean
  onViewFull: () => void
  showViewFull?: boolean
}) {
  const body = textFromBody(detail?.body ?? entry.body)
  const rows = metadataRows(detail?.metadata ?? entry.metadata)
  const attachments = detail?.attachments ?? []
  const [showInternalDetails, setShowInternalDetails] = useState(false)

  return (
    <div className="mt-2 rounded-[10px] border-[0.5px] border-[#eef2f7] bg-[#FAFBFC] p-3">
      {body ? (
        <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[1.6] text-[#374151]">{body}</pre>
      ) : null}

      <div className="mt-3 grid gap-2 text-[11px] text-[#6b7280] md:grid-cols-2">
        <p>Actor: {actorLabel(entry)}</p>
        <p>Occurred: {formatExactDateTime(entry.occurred_at)}</p>
      </div>

      {isLoadingDetail ? <p className="mt-3 text-[12px] text-[#9ca3af]">Loading details...</p> : null}

      {attachments.length > 0 ? (
        <div className="mt-3 rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white p-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#9ca3af]">Attachments</p>
          <div className="mt-2 space-y-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between rounded-[6px] px-2 py-1 text-[12px] text-[#113238]"
              >
                <span className="truncate pr-2">{attachment.filename}</span>
                <span className="shrink-0 text-[10px] text-[#9ca3af]">{formatBytes(attachment.size_bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowInternalDetails((current) => !current)}
          className="mt-3 text-[12px] font-medium text-[#6b7280] underline-offset-2 hover:underline"
        >
          {showInternalDetails ? "Hide internal details" : "Show internal details"}
        </button>
      ) : null}

      {showInternalDetails && rows.length > 0 ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white p-2 text-[11px] md:grid-cols-[140px_1fr]">
          {rows.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-[#9ca3af]">{key}</dt>
              <dd className="break-words text-[#6b7280]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {showViewFull ? (
        <button
          type="button"
          onClick={onViewFull}
          className="mt-3 text-[12px] font-medium text-[#113238] underline-offset-2 hover:underline"
        >
          View full
        </button>
      ) : null}
    </div>
  )
}

export default function ClientTimeline({ party_id }: { party_id: string }) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilterValue>("all")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [detailsById, setDetailsById] = useState<Record<string, TimelineEntryDetail>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [panelEntryId, setPanelEntryId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fromIso = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - 365)
    return from.toISOString()
  }, [])

  const activeKinds = filters.find((filter) => filter.value === activeFilter)?.kinds ?? null
  const hasActiveFilters = activeFilter !== "all" || Boolean(debouncedSearch.trim())

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 250)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchInput])

  const buildTimelineUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        from: fromIso,
      })

      if (activeKinds) {
        params.set("kind", activeKinds.join(","))
      }

      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim())
      }

      if (cursor) {
        params.set("cursor", cursor)
      }

      return `/api/clients/${encodeURIComponent(party_id)}/timeline?${params.toString()}`
    },
    [activeKinds, debouncedSearch, fromIso, party_id],
  )

  const loadTimeline = useCallback(
    async ({ append = false, cursor = null }: { append?: boolean; cursor?: string | null } = {}) => {
      setError(null)
      if (append) {
        setIsLoadingOlder(true)
      } else {
        setIsLoading(true)
        setExpandedEntryId(null)
      }

      try {
        const response = await fetch(buildTimelineUrl(cursor))
        if (!response.ok) {
          throw new Error("Failed to load timeline")
        }

        const payload = (await response.json()) as TimelineListResponse
        const nextEntries = Array.isArray(payload.entries)
          ? payload.entries.filter((entry): entry is TimelineEntry => isTimelineEntry(entry))
          : []
        const next = typeof payload.nextCursor === "string" ? payload.nextCursor : null

        setEntries((current) => (append ? [...current, ...nextEntries] : nextEntries))
        setNextCursor(next)
      } catch (loadError) {
        console.error(loadError)
        setError(loadError instanceof Error ? loadError.message : "Failed to load timeline")
      } finally {
        setIsLoading(false)
        setIsLoadingOlder(false)
      }
    },
    [buildTimelineUrl],
  )

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  async function loadEntryDetail(entryId: string) {
    if (detailsById[entryId]) {
      return detailsById[entryId]
    }

    setDetailLoadingId(entryId)
    try {
      const response = await fetch(`/api/timeline-entries/${encodeURIComponent(entryId)}`)
      if (!response.ok) {
        throw new Error("Failed to load timeline entry")
      }

      const payload = (await response.json()) as DetailResponse
      if (!isTimelineEntry(payload)) {
        throw new Error("Invalid timeline entry response")
      }

      const detail: TimelineEntryDetail = {
        ...payload,
        attachments: Array.isArray(payload.attachments)
          ? payload.attachments.filter((attachment): attachment is TimelineAttachment => isTimelineAttachment(attachment))
          : [],
      }

      setDetailsById((current) => ({
        ...current,
        [entryId]: detail,
      }))

      return detail
    } catch (detailError) {
      console.error(detailError)
      setError(detailError instanceof Error ? detailError.message : "Failed to load timeline entry")
      return null
    } finally {
      setDetailLoadingId(null)
    }
  }

  function handleToggleEntry(entryId: string) {
    setExpandedEntryId((current) => {
      const next = current === entryId ? null : entryId
      if (next) {
        void loadEntryDetail(next)
      }
      return next
    })
  }

  function handleViewFull(entryId: string) {
    setPanelEntryId(entryId)
    void loadEntryDetail(entryId)
  }

  const groupedEntries = groupEntriesByMonth(entries)
  const panelEntry =
    (panelEntryId ? detailsById[panelEntryId] ?? entries.find((entry) => entry.id === panelEntryId) : null) ?? null

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-[14px] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const isActive = filter.value === activeFilter

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`cursor-pointer rounded-[20px] border-[0.5px] border-[#e5e7eb] px-[11px] py-1 text-[12px] ${
                  isActive ? "bg-[#113238] text-white" : "bg-white text-[#113238]"
                }`}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search timeline..."
          className="h-9 w-full rounded-[7px] bg-white px-3 text-[13px] text-[#113238] outline-none ring-[0.5px] ring-[#e5e7eb] placeholder:text-[#9ca3af] md:max-w-[280px]"
        />
      </div>

      {isLoading && entries.length === 0 ? (
        <div className="flex min-h-[260px] flex-1 items-center justify-center">
          <p className="text-[12px] text-[#9ca3af]">Loading timeline...</p>
        </div>
      ) : error && entries.length === 0 ? (
        <div className="rounded-[12px] border-[0.5px] border-[#f9caca] bg-white px-[14px] py-[12px]">
          <p className="text-[12px] text-[#B42318]">{error}</p>
          <button
            type="button"
            onClick={() => void loadTimeline()}
            className="mt-2 rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex min-h-[260px] flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-[14px] text-[#9ca3af]">
              {hasActiveFilters ? "No entries match these filters" : "No activity yet"}
            </p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              {hasActiveFilters ? "Try another filter or search term" : "Client activity will appear here"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-3 rounded-[10px] border-[0.5px] border-[#f9caca] bg-white px-3 py-2">
              <p className="text-[12px] text-[#B42318]">{error}</p>
            </div>
          ) : null}

          <div>
            {groupedEntries.map((group) => (
              <div key={group.label}>
                <div className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-[0.6px] text-[#9ca3af]">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.entries.map((entry) => {
                    const isExpanded = expandedEntryId === entry.id
                    const detail = detailsById[entry.id] ?? null

                    return (
                      <div
                        key={entry.id}
                        className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-[10px] transition-colors hover:border-[#d1d5db]"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleEntry(entry.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <TimelineKindIcon kind={entry.kind} />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] text-[#113238]">{entry.title}</p>
                                <p className="mt-[2px] truncate text-[11px] text-[#9ca3af]">
                                  {formatRelativeDateTime(entry.occurred_at)} - {actorLabel(entry)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {entry.source !== "native" ? (
                                <span className="inline-flex rounded-[999px] bg-[#F3F4F6] px-[8px] py-[2px] text-[10px] uppercase text-[#6B7280]">
                                  {entry.source}
                                </span>
                              ) : null}
                              <span className="text-[11px] text-[#9ca3af]">{humanEntityName(entry.kind)}</span>
                            </div>
                          </div>
                        </button>

                        {isExpanded ? (
                          <TimelineExpansion
                            entry={entry}
                            detail={detail}
                            isLoadingDetail={detailLoadingId === entry.id}
                            onViewFull={() => handleViewFull(entry.id)}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            {nextCursor ? (
              <button
                type="button"
                onClick={() => void loadTimeline({ append: true, cursor: nextCursor })}
                disabled={isLoadingOlder}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[12px] py-[7px] text-[12px] text-[#113238] disabled:opacity-60"
              >
                {isLoadingOlder ? "Loading..." : "Show older"}
              </button>
            ) : (
              <p className="text-[12px] text-[#9ca3af]">End of timeline</p>
            )}
          </div>
        </>
      )}

      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
          panelEntry ? "pointer-events-auto bg-[rgba(17,50,56,0.18)] opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setPanelEntryId(null)}
      >
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
            panelEntry ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {panelEntry ? (
            <>
              <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-[#113238]">{panelEntry.title}</h2>
                  <p className="text-[11px] text-[#9ca3af]">{formatExactDateTime(panelEntry.occurred_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelEntryId(null)}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[9px] py-[4px] text-[14px] leading-none text-[#113238]"
                >
                  x
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TimelineExpansion
                  entry={panelEntry}
                  detail={detailsById[panelEntry.id] ?? null}
                  isLoadingDetail={detailLoadingId === panelEntry.id}
                  onViewFull={() => undefined}
                  showViewFull={false}
                />
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
