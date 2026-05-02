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
import type { SuperPensionAccount } from "@/types/client-record"

type SuperPensionAccountDeleteConfirmProps = {
  clientId: string
  clientDisplayName: string
  account: SuperPensionAccount | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: () => void
}

function formatAccountType(value: string | null | undefined) {
  switch (value) {
    case "super":
      return "Super (accumulation)"
    case "pension":
      return "Pension"
    case "ttr":
      return "Transition to retirement (TTR)"
    case "defined_benefit":
      return "Defined benefit"
    case "smsf":
      return "SMSF"
    default:
      return "super/pension account"
  }
}

function accountIdentifier(account: SuperPensionAccount | null) {
  if (!account) {
    return "this super/pension account"
  }

  const base = `${formatAccountType(account.accountType)} with ${account.providerName}`
  return account.memberNumber?.trim() ? `${base} (member number ${account.memberNumber.trim()})` : base
}

export default function SuperPensionAccountDeleteConfirm({
  clientId,
  clientDisplayName,
  account,
  isOpen,
  onClose,
  onConfirmed,
}: SuperPensionAccountDeleteConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    if (!account) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/clients/${clientId}/super-pension-accounts/${account.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove super/pension account")
      }

      onConfirmed()
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove super/pension account")
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
          <AlertDialogTitle>Remove super/pension account</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the {accountIdentifier(account)} from {clientDisplayName}&apos;s record.
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
