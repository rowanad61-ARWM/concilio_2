"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react"

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
import { CLIENT_DOCUMENT_FOLDERS, type ClientDocumentFolder } from "@/lib/documents"

type DocumentsTabProps = {
  clientId: string
}

type DocumentItem = {
  id: string
  name: string
  size: number
  lastModifiedDateTime: string | null
  webUrl: string | null
  "@microsoft.graph.downloadUrl": string | null
}

type ToastState = {
  kind: "success" | "error"
  message: string
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB"
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatModifiedDate(value: string | null) {
  if (!value) {
    return "Unknown"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

export default function DocumentsTab({ clientId }: DocumentsTabProps) {
  const [activeFolder, setActiveFolder] = useState<ClientDocumentFolder>("ID")
  const [files, setFiles] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFilename, setUploadFilename] = useState("")
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const encodedFolder = useMemo(() => encodeURIComponent(activeFolder), [activeFolder])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    let active = true

    async function loadFiles() {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(clientId)}/${encodedFolder}`)
        if (!response.ok) {
          throw new Error("Failed to fetch files")
        }

        const payload = await response.json()
        const items = Array.isArray(payload) ? payload : []
        const mapped = items
          .map((item): DocumentItem | null => {
            if (!item || typeof item !== "object") {
              return null
            }

            const value = item as Record<string, unknown>
            if (typeof value.id !== "string" || typeof value.name !== "string") {
              return null
            }

            return {
              id: value.id,
              name: value.name,
              size: typeof value.size === "number" ? value.size : 0,
              lastModifiedDateTime:
                typeof value.lastModifiedDateTime === "string" ? value.lastModifiedDateTime : null,
              webUrl: typeof value.webUrl === "string" ? value.webUrl : null,
              "@microsoft.graph.downloadUrl":
                typeof value["@microsoft.graph.downloadUrl"] === "string"
                  ? value["@microsoft.graph.downloadUrl"]
                  : null,
            }
          })
          .filter((item): item is DocumentItem => Boolean(item))

        if (active) {
          setFiles(mapped)
        }
      } catch (error) {
        console.error(error)
        if (active) {
          setToast({ kind: "error", message: "Failed to load documents" })
          setFiles([])
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadFiles()

    return () => {
      active = false
    }
  }, [clientId, encodedFolder])

  function triggerFileBrowse() {
    fileInputRef.current?.click()
  }

  async function refreshFiles() {
    const response = await fetch(`/api/documents/${encodeURIComponent(clientId)}/${encodedFolder}`)
    if (!response.ok) {
      throw new Error("Failed to refresh files")
    }

    const payload = await response.json()
    const items = Array.isArray(payload) ? payload : []
    const mapped = items
      .map((item): DocumentItem | null => {
        if (!item || typeof item !== "object") {
          return null
        }

        const value = item as Record<string, unknown>
        if (typeof value.id !== "string" || typeof value.name !== "string") {
          return null
        }

        return {
          id: value.id,
          name: value.name,
          size: typeof value.size === "number" ? value.size : 0,
          lastModifiedDateTime: typeof value.lastModifiedDateTime === "string" ? value.lastModifiedDateTime : null,
          webUrl: typeof value.webUrl === "string" ? value.webUrl : null,
          "@microsoft.graph.downloadUrl":
            typeof value["@microsoft.graph.downloadUrl"] === "string"
              ? value["@microsoft.graph.downloadUrl"]
              : null,
        }
      })
      .filter((item): item is DocumentItem => Boolean(item))

    setFiles(mapped)
  }

  function uploadSingleFile(file: File) {
    setIsUploading(true)
    setUploadFilename(file.name)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append("file", file)

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `/api/documents/${encodeURIComponent(clientId)}/${encodedFolder}`)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return
        }

        const percent = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(percent)
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            await refreshFiles()
            setToast({ kind: "success", message: "File uploaded" })
            resolve()
          } catch (error) {
            reject(error)
          }

          return
        }

        reject(new Error("Upload failed"))
      }

      xhr.onerror = () => {
        reject(new Error("Upload failed"))
      }

      xhr.send(formData)
    })
      .catch((error) => {
        console.error(error)
        setToast({ kind: "error", message: "Upload failed" })
      })
      .finally(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setUploadFilename("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      })
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    await uploadSingleFile(selectedFile)
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const droppedFile = event.dataTransfer.files?.[0]
    if (!droppedFile) {
      return
    }

    await uploadSingleFile(droppedFile)
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(clientId)}/${encodedFolder}/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      )

      if (!response.ok) {
        throw new Error("Failed to delete file")
      }

      setFiles((current) => current.filter((file) => file.id !== deleteTarget.id))
      setToast({ kind: "success", message: "File deleted" })
      setDeleteTarget(null)
    } catch (error) {
      console.error(error)
      setToast({ kind: "error", message: "Delete failed" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-[14px] flex min-h-[520px] overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
      <aside className="w-[200px] border-r-[0.5px] border-[#e5e7eb] bg-[#F9FAFB] p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.6px] text-[#9ca3af]">Folders</p>
        <div className="space-y-1">
          {CLIENT_DOCUMENT_FOLDERS.map((folder) => {
            const isActive = folder === activeFolder

            return (
              <button
                key={folder}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={`w-full rounded-[7px] px-2 py-[6px] text-left text-[12px] ${
                  isActive ? "bg-[#1a3a5c] text-white" : "text-[#113238] hover:bg-[#EEF2F7]"
                }`}
              >
                {folder}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragging(false)
          }}
          onDrop={(event) => void handleDrop(event)}
          onClick={triggerFileBrowse}
          className={`cursor-pointer rounded-[10px] border border-dashed p-4 transition-colors ${
            dragging ? "border-[#1a3a5c] bg-[#F2F7FC]" : "border-[#d1d5db] bg-[#FAFBFC]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => void handleFileSelection(event)}
          />
          <p className="text-[13px] font-medium text-[#113238]">Drop file here or click to browse</p>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Active folder: {activeFolder}</p>

          {isUploading ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-[#6b7280]">{uploadFilename}</p>
              <div className="h-[6px] rounded-full bg-[#e5e7eb]">
                <div
                  className="h-[6px] rounded-full bg-[#FF8C42] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 min-w-0 flex-1 overflow-auto rounded-[10px] border-[0.5px] border-[#e5e7eb]">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-[#F9FAFB]">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#6b7280]">Name</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#6b7280]">Size</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#6b7280]">Modified</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#6b7280]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-t border-[#f1f5f9]">
                      <td className="px-3 py-2">
                        <div className="h-3 w-[60%] animate-pulse rounded bg-[#EEF2F7]" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-3 w-[50px] animate-pulse rounded bg-[#EEF2F7]" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-3 w-[120px] animate-pulse rounded bg-[#EEF2F7]" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="ml-auto h-3 w-[90px] animate-pulse rounded bg-[#EEF2F7]" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : files.length === 0 ? (
                <tr className="border-t border-[#f1f5f9]">
                  <td colSpan={4} className="px-3 py-6 text-center text-[12px] text-[#9ca3af]">
                    No documents in this folder
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id} className="border-t border-[#f1f5f9]">
                    <td className="px-3 py-2 text-[12px] text-[#113238]">
                      <a
                        href={file.webUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        {file.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-[#6b7280]">{formatFileSize(file.size)}</td>
                    <td className="px-3 py-2 text-[12px] text-[#6b7280]">
                      {formatModifiedDate(file.lastModifiedDateTime)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={file["@microsoft.graph.downloadUrl"] ?? file.webUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] text-[#113238]"
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(file)}
                          className="rounded-[6px] border border-[#F9D6D5] bg-white px-2 py-1 text-[11px] text-[#E24B4A]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name ?? "file"}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteConfirmed()} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-[8px] px-3 py-2 text-[12px] shadow ${
            toast.kind === "success" ? "bg-[#113238] text-white" : "bg-[#E24B4A] text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
