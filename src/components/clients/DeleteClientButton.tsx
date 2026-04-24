"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

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

type DeleteClientButtonProps = {
  clientId: string
  clientName: string
}

type DeletePreviewResponse = {
  deletable: boolean
  reason?: string
  partyName: string
  counts: Record<string, number>
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

export default function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter()
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<DeletePreviewResponse | null>(null)

  useEffect(() => {
    let active = true

    async function loadPreview() {
      setIsLoadingPreview(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/clients/${clientId}/delete-preview`)
        const payload = (await response.json()) as DeletePreviewResponse & { error?: string }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load delete preview")
        }

        if (!active) {
          return
        }

        setPreview(payload)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(toErrorMessage(error))
        setPreview(null)
      } finally {
        if (active) {
          setIsLoadingPreview(false)
        }
      }
    }

    void loadPreview()

    return () => {
      active = false
    }
  }, [clientId])

  const deletable = preview?.deletable === true
  const disableReason =
    isLoadingPreview
      ? "Checking delete eligibility..."
      : preview && !preview.deletable
        ? `${preview.reason ?? "This record cannot be deleted."} Reclassify to 'lost' or 'ceased' instead if this record shouldn't be active.`
        : errorMessage
          ? `Delete preview unavailable: ${errorMessage}`
          : null

  const counts = preview?.counts ?? {}
  const summaryLine = useMemo(
    () =>
      `${counts.engagements ?? 0} engagements, ${counts.workflow_instances ?? 0} workflow instances, ${counts.tasks ?? 0} tasks, ${counts.documents ?? 0} documents, ${counts.notes ?? 0} notes, ${counts.timeline_events ?? 0} timeline events.`,
    [counts],
  )

  async function handleConfirmDelete() {
    if (!deletable || confirmText !== "DELETE") {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete client")
      }

      setIsDialogOpen(false)
      router.push("/clients")
      router.refresh()
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <span title={disableReason ?? undefined}>
        <button
          type="button"
          disabled={!deletable || isLoadingPreview}
          onClick={() => {
            setErrorMessage(null)
            setConfirmText("")
            setIsDialogOpen(true)
          }}
          className="rounded-[7px] border-[0.5px] border-[#E24B4A] bg-white px-[10px] py-[5px] text-[12px] text-[#E24B4A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
      </span>

      <AlertDialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isDeleting) {
            return
          }

          setIsDialogOpen(nextOpen)
          if (!nextOpen) {
            setConfirmText("")
            setErrorMessage(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {clientName}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will delete the record and everything attached to it: {summaryLine}
              </span>
              <span className="block font-medium text-[#7f1d1d]">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 space-y-2">
            <label htmlFor="delete-confirm-input" className="block text-[12px] text-[#6b7280]">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm-input"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
              className="w-full rounded-[7px] border border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238] outline-none"
            />
            {errorMessage ? <p className="text-[12px] text-[#E24B4A]">{errorMessage}</p> : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || confirmText !== "DELETE" || !deletable}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

