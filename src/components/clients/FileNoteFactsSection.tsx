"use client"

export type ParkOnlyCategoryOption = {
  category: string
  description: string
}

export type FactAction = "update" | "park" | "drop"

export type ReviewFactRow = {
  id: string
  action: FactAction
  summary: string
  source_quote: string | null
  category: string
  confidence: "high" | "medium" | "low" | null
  target: {
    table: string
    column: string
    party_scope: "primary" | "household"
  } | null
  current_value: string | number | boolean | null
  value_to_write: string | number | boolean | null
  parked_summary: string
  parked_category: string
  parked_notes: string | null
  raw_extract: Record<string, unknown>
}

type FileNoteFactsSectionProps = {
  isPublished: boolean
  factRows: ReviewFactRow[] | null
  factPublishDecisions: unknown
  parkOnlyCategories: ParkOnlyCategoryOption[]
  description: string
  onRefresh: () => void
  onChange: (rows: ReviewFactRow[] | null) => void
}

const inputClassName =
  "w-full rounded-[8px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[13px] text-[#113238] outline-none focus:border-[#113238] disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]"

const textAreaClassName =
  "w-full resize-y rounded-[10px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-3 text-[13px] leading-[1.6] text-[#113238] outline-none focus:border-[#113238] disabled:bg-[#f3f4f6] disabled:text-[#9ca3af]"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function scalarValue(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return null
}

function normalizeAction(value: unknown): FactAction {
  return value === "update" || value === "park" || value === "drop" ? value : "park"
}

function normalizeConfidence(value: unknown): ReviewFactRow["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : null
}

function browserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `fact-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function valueToText(value: string | number | boolean | null) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function targetFromValue(value: unknown): ReviewFactRow["target"] {
  if (!isRecord(value)) {
    return null
  }

  const table = nullableString(value.table)
  const column = nullableString(value.column)
  const partyScope = nullableString(value.party_scope)
  if (!table || !column || (partyScope !== "primary" && partyScope !== "household")) {
    return null
  }

  return { table, column, party_scope: partyScope }
}

export function parseExtractedFacts(value: unknown, parkOnlyCategories: ParkOnlyCategoryOption[] = []): ReviewFactRow[] | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!Array.isArray(value)) {
    return []
  }

  const rows: ReviewFactRow[] = []
  value.forEach((fact, index) => {
    if (!isRecord(fact)) {
      return
    }

    const summary = nullableString(fact.summary)
    if (!summary) {
      return
    }

    const action = normalizeAction(fact.proposed_action)
    const category = nullableString(fact.category) ?? "other"
    const target = targetFromValue(fact.proposed_target)
    const parkCategory =
      action === "park" && parkOnlyCategories.some((option) => option.category === category) ? category : "other"

    rows.push({
      id: nullableString(fact.id) ?? `extracted-fact-${index}`,
      action,
      summary,
      source_quote: nullableString(fact.source_quote),
      category,
      confidence: normalizeConfidence(fact.confidence),
      target,
      current_value: scalarValue(fact.current_value),
      value_to_write: scalarValue(fact.proposed_value),
      parked_summary: summary,
      parked_category: parkCategory,
      parked_notes: null,
      raw_extract: fact,
    })
  })

  return rows
}

function truncateText(value: string, maxLength = 220) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function actionButtonClass(isSelected: boolean) {
  return `rounded-[7px] border-[0.5px] px-3 py-2 text-[12px] font-medium ${
    isSelected
      ? "border-[#113238] bg-[#113238] text-white"
      : "border-[#dbe3e8] bg-white text-[#113238] hover:bg-[#f7fafb]"
  }`
}

export default function FileNoteFactsSection({
  isPublished,
  factRows,
  factPublishDecisions,
  parkOnlyCategories,
  description,
  onRefresh,
  onChange,
}: FileNoteFactsSectionProps) {
  const decisionCount = Array.isArray(factPublishDecisions) ? factPublishDecisions.length : null
  const counts = factRows?.reduce(
    (acc, fact) => {
      acc[fact.action] += 1
      return acc
    },
    { update: 0, park: 0, drop: 0 },
  )

  function updateFact(id: string, patch: Partial<ReviewFactRow>) {
    onChange(
      factRows?.map((fact) => {
        if (fact.id !== id) {
          return fact
        }

        return { ...fact, ...patch }
      }) ?? null,
    )
  }

  return (
    <section className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-5 py-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#113238]">Facts to confirm</h2>
          <p className="mt-1 text-[12px] leading-[1.5] text-[#6b7280]">
            {description} Update writes to the client record. Park keeps for future review. Drop discards.
          </p>
        </div>
      </div>

      {isPublished ? (
        <p className="text-[13px] text-[#6b7280]">
          {decisionCount
            ? `${decisionCount} fact decision${decisionCount === 1 ? "" : "s"} captured when this note was published.`
            : "No fact decisions were captured for this note."}
        </p>
      ) : factRows === null ? (
        <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
          <p className="text-[13px] text-[#6b7280]">Fact extraction not yet complete.</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-3 rounded-[7px] border-[0.5px] border-[#dbe3e8] bg-white px-3 py-2 text-[12px] font-medium text-[#113238] hover:bg-[#f7fafb]"
          >
            Refresh
          </button>
        </div>
      ) : factRows.length === 0 ? (
        <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
          <p className="text-[13px] text-[#6b7280]">No structured facts detected in this conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-[#6b7280]">
            Current selections: {counts?.update ?? 0} update, {counts?.park ?? 0} park, {counts?.drop ?? 0} drop.
          </p>
          {factRows.map((fact) => (
            <div key={fact.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#fbfcfd] px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-[#113238]">{fact.summary}</p>
                    <span className="rounded-full border-[0.5px] border-[#dbe3e8] bg-white px-2 py-1 text-[11px] text-[#6b7280]">
                      {fact.category}
                    </span>
                    {fact.confidence ? (
                      <span className="rounded-full border-[0.5px] border-[#dbe3e8] bg-white px-2 py-1 text-[11px] text-[#6b7280]">
                        {fact.confidence} confidence
                      </span>
                    ) : null}
                  </div>
                  {fact.source_quote ? (
                    <p className="text-[12px] italic leading-[1.5] text-[#6b7280]">
                      Source: "{truncateText(fact.source_quote)}"
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(["update", "park", "drop"] as FactAction[]).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => updateFact(fact.id, { action })}
                      className={actionButtonClass(fact.action === action)}
                    >
                      {action[0].toUpperCase() + action.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {fact.action === "update" ? (
                <div className="mt-3 rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-3">
                  {fact.target ? (
                    <p className="mb-3 text-[12px] text-[#6b7280]">
                      Writes to <span className="font-medium text-[#113238]">{fact.target.table}.{fact.target.column}</span>
                    </p>
                  ) : (
                    <p className="mb-3 text-[12px] text-[#B42318]">No schema target was provided for this update.</p>
                  )}
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Concilio</span>
                      <input value={valueToText(fact.current_value)} disabled className={inputClassName} />
                    </label>
                    <span className="hidden pb-2 text-[13px] text-[#9ca3af] md:block">-&gt;</span>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Value to write</span>
                      <input
                        value={valueToText(fact.value_to_write)}
                        onChange={(event) => updateFact(fact.id, { value_to_write: event.target.value })}
                        className={inputClassName}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {fact.action === "park" ? (
                <div className="mt-3 grid gap-3 rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Category</span>
                    <select
                      value={fact.parked_category}
                      onChange={(event) => updateFact(fact.id, { parked_category: event.target.value })}
                      className={inputClassName}
                    >
                      {parkOnlyCategories.map((category) => (
                        <option key={category.category} value={category.category}>
                          {category.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Summary</span>
                    <input
                      value={fact.parked_summary}
                      onChange={(event) => updateFact(fact.id, { parked_summary: event.target.value })}
                      className={inputClassName}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Notes</span>
                    <textarea
                      rows={3}
                      value={fact.parked_notes ?? ""}
                      onChange={(event) => updateFact(fact.id, { parked_notes: event.target.value || null })}
                      className={textAreaClassName}
                    />
                  </label>
                </div>
              ) : null}

              {fact.action === "drop" ? (
                <div className="mt-3 rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-3">
                  <p className="text-[12px] text-[#6b7280]">This fact will not update Concilio or create a parked fact. The drop decision will be kept on the file note audit trail.</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
