"use client"

import { useEffect, useMemo, useState } from "react"

export const TASK_STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_EXTERNAL", label: "Waiting External" },
  { value: "WAITING_INTERNAL", label: "Waiting Internal" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "WITH_CLIENT", label: "With Client" },
  { value: "STUCK", label: "Stuck" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "DONE", label: "Done" },
] as const

export type TaskStatusValue = (typeof TASK_STATUS_OPTIONS)[number]["value"]

export type TaskTypeGroup = {
  type: string
  subtypes: string[]
}

export type TaskOwnerOption = {
  id: string
  fullName: string
  email: string
}

export type EditableTaskEntry = {
  id: string
  title: string
  description: string | null
  type: string
  subtype: string | null
  status: TaskStatusValue
  ownerUserId: string | null
  dueDateStart: string | null
  dueDateEnd: string | null
}

type TaskModalProps = {
  isOpen: boolean
  mode: "create" | "edit"
  clientId: string
  taskTypeOptions: TaskTypeGroup[]
  ownerOptions: TaskOwnerOption[]
  task?: EditableTaskEntry | null
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  return parsed.toISOString().slice(0, 10)
}

export default function TaskModal({
  isOpen,
  mode,
  clientId,
  taskTypeOptions,
  ownerOptions,
  task,
  onClose,
  onSaved,
  onError,
}: TaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("")
  const [subtype, setSubtype] = useState("")
  const [status, setStatus] = useState<TaskStatusValue>("NOT_STARTED")
  const [ownerUserId, setOwnerUserId] = useState("")
  const [dueDateMode, setDueDateMode] = useState<"single" | "range">("single")
  const [singleDueDate, setSingleDueDate] = useState("")
  const [dueDateStart, setDueDateStart] = useState("")
  const [dueDateEnd, setDueDateEnd] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const availableTypes = useMemo(
    () => taskTypeOptions.map((option) => option.type),
    [taskTypeOptions],
  )

  const availableSubtypes = useMemo(
    () => taskTypeOptions.find((option) => option.type === type)?.subtypes ?? [],
    [taskTypeOptions, type],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (mode === "edit" && task) {
      const hasRange = Boolean(task.dueDateStart && task.dueDateEnd)
      setTitle(task.title)
      setDescription(task.description ?? "")
      setType(task.type)
      setSubtype(task.subtype ?? "")
      setStatus(task.status)
      setOwnerUserId(task.ownerUserId ?? "")
      setDueDateMode(hasRange ? "range" : "single")
      setSingleDueDate(toDateInputValue(task.dueDateStart))
      setDueDateStart(toDateInputValue(task.dueDateStart))
      setDueDateEnd(toDateInputValue(task.dueDateEnd))
      return
    }

    setTitle("")
    setDescription("")
    setType(availableTypes[0] ?? "")
    setSubtype("")
    setStatus("NOT_STARTED")
    setOwnerUserId("")
    setDueDateMode("single")
    setSingleDueDate("")
    setDueDateStart("")
    setDueDateEnd("")
  }, [isOpen, mode, task, availableTypes])

  useEffect(() => {
    if (!availableSubtypes.includes(subtype)) {
      setSubtype("")
    }
  }, [availableSubtypes, subtype])

  async function handleSave() {
    if (!title.trim()) {
      onError("Task title is required.")
      return
    }

    if (!type) {
      onError("Task type is required.")
      return
    }

    if (dueDateMode === "range" && dueDateEnd && !dueDateStart) {
      onError("Start date is required when end date is set.")
      return
    }

    const payload = {
      clientId,
      title: title.trim(),
      description: description.trim() || null,
      type,
      subtype: subtype || null,
      status,
      ownerUserId: ownerUserId || null,
      dueDateStart: dueDateMode === "single" ? (singleDueDate || null) : dueDateStart || null,
      dueDateEnd: dueDateMode === "range" ? dueDateEnd || null : null,
    }

    setIsSaving(true)
    try {
      const endpoint = mode === "create" ? "/api/tasks" : `/api/tasks/${task?.id ?? ""}`
      const method = mode === "create" ? "POST" : "PUT"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const responsePayload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(responsePayload.error ?? "Failed to save task")
      }

      onSaved()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save task"
      onError(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,50,56,0.35)] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] rounded-[12px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#113238]">
              {mode === "create" ? "New Task" : "Edit Task"}
            </h2>
            <p className="text-[12px] text-[#6b7280]">
              {mode === "create" ? "Create a task for this client." : "Update task details."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border-[0.5px] border-[#e5e7eb] px-2 py-1 text-[12px] text-[#113238]"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Owner</span>
            <select
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            >
              <option value="">Unassigned</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName} ({owner.email})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            >
              <option value="" disabled>
                Select type
              </option>
              {availableTypes.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Subtype</span>
            <select
              value={subtype}
              onChange={(event) => setSubtype(event.target.value)}
              disabled={availableSubtypes.length === 0}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] disabled:bg-[#F7F9FB] disabled:text-[#9ca3af]"
            >
              <option value="">{availableSubtypes.length > 0 ? "Optional" : "No subtypes"}</option>
              {availableSubtypes.map((subtypeOption) => (
                <option key={subtypeOption} value={subtypeOption}>
                  {subtypeOption}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatusValue)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            >
              {TASK_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Due Date Type</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDueDateMode("single")}
                className={`rounded-[7px] border-[0.5px] px-[10px] py-[6px] text-[12px] ${
                  dueDateMode === "single"
                    ? "border-[#113238] bg-[#113238] text-white"
                    : "border-[#e5e7eb] bg-white text-[#113238]"
                }`}
              >
                Single date
              </button>
              <button
                type="button"
                onClick={() => setDueDateMode("range")}
                className={`rounded-[7px] border-[0.5px] px-[10px] py-[6px] text-[12px] ${
                  dueDateMode === "range"
                    ? "border-[#113238] bg-[#113238] text-white"
                    : "border-[#e5e7eb] bg-white text-[#113238]"
                }`}
              >
                Date range
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {dueDateMode === "single" ? (
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Due date</span>
              <input
                type="date"
                value={singleDueDate}
                onChange={(event) => setSingleDueDate(event.target.value)}
                className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
              />
            </label>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Start date</span>
                <input
                  type="date"
                  value={dueDateStart}
                  onChange={(event) => setDueDateStart(event.target.value)}
                  className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">End date</span>
                <input
                  type="date"
                  value={dueDateEnd}
                  onChange={(event) => setDueDateEnd(event.target.value)}
                  className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                />
              </label>
            </div>
          )}
        </div>

        <label className="mt-3 block space-y-1">
          <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[120px] w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#113238]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-[8px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-3 py-2 text-[12px] text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
