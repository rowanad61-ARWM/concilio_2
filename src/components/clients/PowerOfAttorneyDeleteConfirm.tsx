"use client"

import { useState } from "react"

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
import type { PowerOfAttorney } from "@/types/client-record"

type PowerOfAttorneyDeleteConfirmProps = {
  clientId: string
  clientDisplayName: string
  powerOfAttorney: PowerOfAttorney | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: () => void
}

function formatPoaType(value: string | null | undefined) {
  switch (value) {
    case "enduring":
      return "enduring"
    case "general":
      return "general"
    case "medical":
      return "medical"
    case "financial":
      return "financial"
    case "other":
      return "other"
    default:
      return "recorded"
  }
}

function attorneyName(powerOfAttorney: PowerOfAttorney | null) {
  if (!powerOfAttorney) {
    return "this person"
  }

  const personName = [powerOfAttorney.firstName, powerOfAttorney.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")

  if (personName) {
    return personName
  }

  if (powerOfAttorney.preferredName?.trim()) {
    return powerOfAttorney.preferredName.trim()
  }

  return "this person"
}

export default function PowerOfAttorneyDeleteConfirm({
  clientId,
  clientDisplayName,
  powerOfAttorney,
  isOpen,
  onClose,
  onConfirmed,
}: PowerOfAttorneyDeleteConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    if (!powerOfAttorney) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/powers-of-attorney/${powerOfAttorney.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove power of attorney")
      }

      onConfirmed()
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove power of attorney")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (isDeleting) {
          return
        }

        if (!nextOpen) {
          setErrorMessage(null)
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove power of attorney</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the {formatPoaType(powerOfAttorney?.poaType)} power of attorney held by{" "}
            {attorneyName(powerOfAttorney)} from {clientDisplayName}&apos;s record. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? (
          <div className="rounded-[8px] border-[0.5px] border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B42318]">
            {errorMessage}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
            disabled={isDeleting}
            className="bg-[#B42318] text-white hover:bg-[#991B1B]"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
