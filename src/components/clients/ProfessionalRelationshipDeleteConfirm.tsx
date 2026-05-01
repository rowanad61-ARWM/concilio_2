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
import type { ProfessionalRelationship } from "@/types/client-record"

type ProfessionalRelationshipDeleteConfirmProps = {
  clientId: string
  clientDisplayName: string
  relationship: ProfessionalRelationship | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: () => void
}

function relationshipName(relationship: ProfessionalRelationship | null) {
  if (!relationship) {
    return "this professional relationship"
  }

  const personName = [relationship.firstName, relationship.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")

  if (personName) {
    return personName
  }

  if (relationship.company?.trim()) {
    return relationship.company.trim()
  }

  return "this professional relationship"
}

export default function ProfessionalRelationshipDeleteConfirm({
  clientId,
  clientDisplayName,
  relationship,
  isOpen,
  onClose,
  onConfirmed,
}: ProfessionalRelationshipDeleteConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    if (!relationship) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/professional-relationships/${relationship.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove professional relationship")
      }

      onConfirmed()
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove professional relationship")
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
          <AlertDialogTitle>Remove professional relationship</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {relationshipName(relationship)} from {clientDisplayName}&apos;s record.
            This action cannot be undone.
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
