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
import type { EstateBeneficiary } from "@/types/client-record"

type EstateBeneficiaryDeleteConfirmProps = {
  clientId: string
  clientDisplayName: string
  beneficiary: EstateBeneficiary | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: () => void
}

function beneficiaryName(beneficiary: EstateBeneficiary | null) {
  if (!beneficiary) {
    return "this beneficiary"
  }

  const personName = [beneficiary.firstName, beneficiary.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")

  if (personName) {
    return personName
  }

  if (beneficiary.preferredName?.trim()) {
    return beneficiary.preferredName.trim()
  }

  return "this beneficiary"
}

export default function EstateBeneficiaryDeleteConfirm({
  clientId,
  clientDisplayName,
  beneficiary,
  isOpen,
  onClose,
  onConfirmed,
}: EstateBeneficiaryDeleteConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    if (!beneficiary) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/estate-beneficiaries/${beneficiary.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove beneficiary")
      }

      onConfirmed()
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove beneficiary")
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
          <AlertDialogTitle>Remove beneficiary</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {beneficiaryName(beneficiary)} from {clientDisplayName}&apos;s record.
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
