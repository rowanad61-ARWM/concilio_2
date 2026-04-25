"use client"

import { useEffect, useMemo, useState } from "react"

import { CLIENT_DOCUMENT_FOLDERS, type ClientDocumentFolder, normalizeClientDocumentFolder } from "@/lib/documents"

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
  { value: "CANCELLED", label: "Cancelled" },
] as const

export const RECURRENCE_CADENCE_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "YEARLY", label: "Yearly" },
] as const

export type TaskStatusValue = (typeof TASK_STATUS_OPTIONS)[number]["value"]
export type RecurrenceCadenceValue = (typeof RECURRENCE_CADENCE_OPTIONS)[number]["value"]

export type TaskTypeGroup = {
  type: string
  subtypes: string[]
}

export type TaskOwnerOption = {
  id: string
  fullName: string
  email: string
}

export type TaskDocumentLinkEntry = {
  id: string
  sharepointDriveItemId: string
  fileName: string
  folder: string
  createdAt: string
}

export type EditableTaskEntry = {
  id: string
  title: string
  description: string | null
  type: string
  subtype: string | null
  status: TaskStatusValue
  owners: TaskOwnerOption[]
  dueDateStart: string | null
  dueDateEnd: string | null
  isRecurring: boolean
  recurrenceCadence: RecurrenceCadenceValue | null
  recurrenceEndDate: string | null
  recurrenceCount: number | null
  parentTaskId: string | null
  documentLinks: TaskDocumentLinkEntry[]
  workflowSpawnedTaskId?: string | null
  workflowTaskTemplateId?: string | null
  workflowTaskTemplateTitle?: string | null
  ownerUserId?: string | null
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
  onWarning?: (message: string) => void
}

type DocumentPickerItem = {
  id: string
  name: string
}

type LinkedDocumentDraft = {
  id: string
  sharepointDriveItemId: string
  fileName: string
  folder: ClientDocumentFolder
  createdAt: string
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

function toInitials(fullName: string) {
  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function normalizeTaskDocumentLinks(links: TaskDocumentLinkEntry[] | undefined) {
  if (!links || links.length === 0) {
    return []
  }

  return links
    .map((link) => {
      const normalizedFolder = normalizeClientDocumentFolder(link.folder)
      if (!normalizedFolder) {
        return null
      }

      return {
        id: link.id,
        sharepointDriveItemId: link.sharepointDriveItemId,
        fileName: link.fileName,
        folder: normalizedFolder,
        createdAt: link.createdAt,
      } satisfies LinkedDocumentDraft
    })
    .filter((link): link is LinkedDocumentDraft => Boolean(link))
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
  onWarning,
}: TaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("")
  const [subtype, setSubtype] = useState("")
  const [status, setStatus] = useState<TaskStatusValue>("NOT_STARTED")
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([])
  const [dueDateMode, setDueDateMode] = useState<"single" | "range">("single")
  const [singleDueDate, setSingleDueDate] = useState("")
  const [dueDateStart, setDueDateStart] = useState("")
  const [dueDateEnd, setDueDateEnd] = useState("")
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceCadence, setRecurrenceCadence] = useState<RecurrenceCadenceValue>("MONTHLY")
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<"none" | "date" | "count">("none")
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("")
  const [recurrenceCount, setRecurrenceCount] = useState("")
  const [documentFolder, setDocumentFolder] = useState<ClientDocumentFolder>(CLIENT_DOCUMENT_FOLDERS[0])
  const [folderFiles, setFolderFiles] = useState<DocumentPickerItem[]>([])
  const [selectedFileId, setSelectedFileId] = useState("")
  const [linkedDocuments, setLinkedDocuments] = useState<LinkedDocumentDraft[]>([])
  const [isLoadingFolderFiles, setIsLoadingFolderFiles] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const availableTypes = useMemo(
    () => taskTypeOptions.map((option) => option.type),
    [taskTypeOptions],
  )

  const availableSubtypes = useMemo(
    () => taskTypeOptions.find((option) => option.type === type)?.subtypes ?? [],
    [taskTypeOptions, type],
  )

  const ownerLookup = useMemo(() => {
    return new Map(ownerOptions.map((owner) => [owner.id, owner]))
  }, [ownerOptions])

  const selectedOwners = useMemo(
    () => selectedOwnerIds.map((ownerId) => ownerLookup.get(ownerId)).filter((owner): owner is TaskOwnerOption => Boolean(owner)),
    [ownerLookup, selectedOwnerIds],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (mode === "edit" && task) {
      const hasRange = Boolean(task.dueDateStart && task.dueDateEnd)
      const ownerIdsFromTask = task.owners.length > 0 ? task.owners.map((owner) => owner.id) : []
      const fallbackOwnerIds = task.ownerUserId ? [task.ownerUserId] : []
      const initialOwnerIds = ownerIdsFromTask.length > 0 ? ownerIdsFromTask : fallbackOwnerIds

      setTitle(task.title)
      setDescription(task.description ?? "")
      setType(task.type)
      setSubtype(task.subtype ?? "")
      setStatus(task.status)
      setSelectedOwnerIds(Array.from(new Set(initialOwnerIds)))
      setDueDateMode(hasRange ? "range" : "single")
      setSingleDueDate(toDateInputValue(task.dueDateStart))
      setDueDateStart(toDateInputValue(task.dueDateStart))
      setDueDateEnd(toDateInputValue(task.dueDateEnd))
      setIsRecurring(task.isRecurring)
      setRecurrenceCadence(task.recurrenceCadence ?? "MONTHLY")
      setRecurrenceEndDate(toDateInputValue(task.recurrenceEndDate))
      setRecurrenceCount(task.recurrenceCount ? String(task.recurrenceCount) : "")
      setRecurrenceEndMode(task.recurrenceEndDate ? "date" : task.recurrenceCount ? "count" : "none")
      setLinkedDocuments(normalizeTaskDocumentLinks(task.documentLinks))
      setSelectedFileId("")
      return
    }

    setTitle("")
    setDescription("")
    setType(availableTypes[0] ?? "")
    setSubtype("")
    setStatus("NOT_STARTED")
    setSelectedOwnerIds([])
    setDueDateMode("single")
    setSingleDueDate("")
    setDueDateStart("")
    setDueDateEnd("")
    setIsRecurring(false)
    setRecurrenceCadence("MONTHLY")
    setRecurrenceEndMode("none")
    setRecurrenceEndDate("")
    setRecurrenceCount("")
    setLinkedDocuments([])
    setSelectedFileId("")
  }, [isOpen, mode, task, availableTypes])

  useEffect(() => {
    if (!availableSubtypes.includes(subtype)) {
      setSubtype("")
    }
  }, [availableSubtypes, subtype])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let active = true

    async function loadFolderFiles() {
      setIsLoadingFolderFiles(true)

      try {
        const response = await fetch(
          `/api/documents/${encodeURIComponent(clientId)}/${encodeURIComponent(documentFolder)}`,
        )

        if (!response.ok) {
          throw new Error("Failed to load folder files")
        }

        const payload = (await response.json()) as unknown
        const files = Array.isArray(payload) ? payload : []
        const mapped = files
          .map((item): DocumentPickerItem | null => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null
            }

            const value = item as Record<string, unknown>
            if (typeof value.id !== "string" || typeof value.name !== "string") {
              return null
            }

            return {
              id: value.id,
              name: value.name,
            }
          })
          .filter((item): item is DocumentPickerItem => Boolean(item))

        if (active) {
          setFolderFiles(mapped)
          setSelectedFileId((current) => (mapped.some((file) => file.id === current) ? current : ""))
        }
      } catch (error) {
        console.error(error)
        if (active) {
          setFolderFiles([])
          setSelectedFileId("")
        }
      } finally {
        if (active) {
          setIsLoadingFolderFiles(false)
        }
      }
    }

    void loadFolderFiles()

    return () => {
      active = false
    }
  }, [clientId, documentFolder, isOpen])

  function toggleOwner(ownerId: string) {
    setSelectedOwnerIds((current) =>
      current.includes(ownerId) ? current.filter((value) => value !== ownerId) : [...current, ownerId],
    )
  }

  function linkSelectedDocument() {
    if (!selectedFileId) {
      onError("Select a file to link.")
      return
    }

    const selectedFile = folderFiles.find((file) => file.id === selectedFileId)
    if (!selectedFile) {
      onError("Selected file was not found.")
      return
    }

    const exists = linkedDocuments.some(
      (document) =>
        document.sharepointDriveItemId === selectedFile.id ||
        (document.folder === documentFolder && document.fileName === selectedFile.name),
    )

    if (exists) {
      onWarning?.("This document is already linked to the task.")
      return
    }

    const nowIso = new Date().toISOString()

    setLinkedDocuments((current) => [
      {
        id: `temp-${selectedFile.id}`,
        sharepointDriveItemId: selectedFile.id,
        fileName: selectedFile.name,
        folder: documentFolder,
        createdAt: nowIso,
      },
      ...current,
    ])
  }

  function unlinkDocument(linkId: string) {
    setLinkedDocuments((current) => current.filter((document) => document.id !== linkId))
  }

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

    if (isRecurring) {
      if (!recurrenceCadence) {
        onError("Recurrence cadence is required.")
        return
      }

      if (recurrenceEndMode === "date" && !recurrenceEndDate) {
        onError("Recurrence end date is required.")
        return
      }

      if (recurrenceEndMode === "count") {
        const count = Number(recurrenceCount)
        if (!Number.isInteger(count) || count <= 0) {
          onError("Recurrence count must be a positive whole number.")
          return
        }
      }

      const recurrenceDue = dueDateMode === "single" ? singleDueDate : dueDateStart
      if (!recurrenceDue) {
        onError("Recurring tasks require a due date.")
        return
      }
    }

    const payload = {
      clientId,
      title: title.trim(),
      description: description.trim() || null,
      type,
      subtype: subtype || null,
      status,
      owners: selectedOwnerIds,
      dueDateStart: dueDateMode === "single" ? singleDueDate || null : dueDateStart || null,
      dueDateEnd: dueDateMode === "range" ? dueDateEnd || null : null,
      isRecurring,
      recurrenceCadence: isRecurring ? recurrenceCadence : null,
      recurrenceEndDate: isRecurring && recurrenceEndMode === "date" ? recurrenceEndDate || null : null,
      recurrenceCount: isRecurring && recurrenceEndMode === "count" ? Number(recurrenceCount) : null,
      documentLinks: linkedDocuments.map((document) => ({
        folder: document.folder,
        fileId: document.sharepointDriveItemId,
        fileName: document.fileName,
      })),
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

      const responsePayload = (await response.json()) as { error?: string; code?: string }

      if (!response.ok) {
        if (response.status === 409 && responsePayload.code === "DUPLICATE_LIVE_RECURRING") {
          onWarning?.(responsePayload.error ?? "A live recurring task already exists.")
          return
        }

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
        className="max-h-[95vh] w-full max-w-[860px] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl"
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

          <div className="space-y-1 md:col-span-2">
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
            className="min-h-[100px] w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
          />
        </label>

        <section className="mt-4 rounded-[10px] border-[0.5px] border-[#e5e7eb] p-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#113238]">Multi-owner</h3>
          <p className="mt-1 text-[11px] text-[#6b7280]">Assign one or more staff members.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {selectedOwners.length > 0 ? (
              selectedOwners.map((owner) => (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => toggleOwner(owner.id)}
                  className="inline-flex items-center gap-2 rounded-[999px] border-[0.5px] border-[#dbe3ea] bg-[#F6F9FC] px-2 py-1 text-[11px] text-[#113238]"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#113238] text-[10px] text-white">
                    {toInitials(owner.fullName)}
                  </span>
                  {owner.fullName}
                  <span className="text-[#9ca3af]">x</span>
                </button>
              ))
            ) : (
              <span className="text-[11px] text-[#9ca3af]">No owners selected</span>
            )}
          </div>

          <div className="mt-3 max-h-[132px] overflow-y-auto rounded-[8px] border-[0.5px] border-[#e5e7eb] p-2">
            <div className="grid gap-2 md:grid-cols-2">
              {ownerOptions.map((owner) => {
                const isSelected = selectedOwnerIds.includes(owner.id)
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => toggleOwner(owner.id)}
                    className={`flex items-center justify-between rounded-[7px] border-[0.5px] px-2 py-[6px] text-left text-[12px] ${
                      isSelected
                        ? "border-[#113238] bg-[#113238] text-white"
                        : "border-[#e5e7eb] bg-white text-[#113238]"
                    }`}
                  >
                    <span className="truncate pr-2">{owner.fullName}</span>
                    <span className={`text-[10px] ${isSelected ? "text-white" : "text-[#9ca3af]"}`}>{owner.email}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[10px] border-[0.5px] border-[#e5e7eb] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#113238]">Recurrence</h3>
              <p className="mt-1 text-[11px] text-[#6b7280]">Create follow-up task instances automatically.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-[12px] text-[#113238]">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(event) => setIsRecurring(event.target.checked)}
              />
              Recurring
            </label>
          </div>

          {isRecurring ? (
            <div className="mt-3 space-y-3">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Cadence</span>
                <select
                  value={recurrenceCadence}
                  onChange={(event) => setRecurrenceCadence(event.target.value as RecurrenceCadenceValue)}
                  className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                >
                  {RECURRENCE_CADENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">End condition</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRecurrenceEndMode("none")}
                    className={`rounded-[7px] border-[0.5px] px-[10px] py-[6px] text-[12px] ${
                      recurrenceEndMode === "none"
                        ? "border-[#113238] bg-[#113238] text-white"
                        : "border-[#e5e7eb] bg-white text-[#113238]"
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceEndMode("date")}
                    className={`rounded-[7px] border-[0.5px] px-[10px] py-[6px] text-[12px] ${
                      recurrenceEndMode === "date"
                        ? "border-[#113238] bg-[#113238] text-white"
                        : "border-[#e5e7eb] bg-white text-[#113238]"
                    }`}
                  >
                    End date
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceEndMode("count")}
                    className={`rounded-[7px] border-[0.5px] px-[10px] py-[6px] text-[12px] ${
                      recurrenceEndMode === "count"
                        ? "border-[#113238] bg-[#113238] text-white"
                        : "border-[#e5e7eb] bg-white text-[#113238]"
                    }`}
                  >
                    Count
                  </button>
                </div>
              </div>

              {recurrenceEndMode === "date" ? (
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Recurrence end date</span>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(event) => setRecurrenceEndDate(event.target.value)}
                    className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                  />
                </label>
              ) : null}

              {recurrenceEndMode === "count" ? (
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Total instances</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={recurrenceCount}
                    onChange={(event) => setRecurrenceCount(event.target.value)}
                    className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-[10px] border-[0.5px] border-[#e5e7eb] p-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#113238]">Linked documents</h3>
          <p className="mt-1 text-[11px] text-[#6b7280]">Link existing SharePoint files. Uploading is available in Documents.</p>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Folder</span>
              <select
                value={documentFolder}
                onChange={(event) => setDocumentFolder(event.target.value as ClientDocumentFolder)}
                className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
              >
                {CLIENT_DOCUMENT_FOLDERS.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">File</span>
              <select
                value={selectedFileId}
                onChange={(event) => setSelectedFileId(event.target.value)}
                disabled={isLoadingFolderFiles}
                className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] disabled:bg-[#F7F9FB] disabled:text-[#9ca3af]"
              >
                <option value="">
                  {isLoadingFolderFiles
                    ? "Loading files..."
                    : folderFiles.length > 0
                      ? "Select a file"
                      : "No files in folder"}
                </option>
                {folderFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={linkSelectedDocument}
                disabled={!selectedFileId || isLoadingFolderFiles}
                className="w-full rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
              >
                Link
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-[8px] border-[0.5px] border-[#e5e7eb] p-2">
            {linkedDocuments.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af]">No linked documents yet</p>
            ) : (
              <div className="space-y-2">
                {linkedDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-[7px] border-[0.5px] border-[#eef2f7] bg-[#FAFBFC] px-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-[#113238]">{document.fileName}</p>
                      <p className="text-[11px] text-[#9ca3af]">{document.folder}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => unlinkDocument(document.id)}
                      className="rounded-[6px] border-[0.5px] border-[#f9caca] bg-white px-2 py-1 text-[11px] text-[#E24B4A]"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

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
