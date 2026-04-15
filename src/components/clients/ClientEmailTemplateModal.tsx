"use client"

import { useEffect, useMemo, useState } from "react"

type EmailTemplateOption = {
  id: string
  name: string
  subject: string
  category: string
}

type PreviewResult = {
  subject: string
  body: string
}

type ClientEmailTemplateModalProps = {
  isOpen: boolean
  onClose: () => void
  clientId: string
  clientName: string
  onToast: (toast: { kind: "success" | "error"; message: string }) => void
  onSent: () => void
}

export default function ClientEmailTemplateModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onToast,
  onSent,
}: ClientEmailTemplateModalProps) {
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let isMounted = true

    async function loadTemplates() {
      setIsLoadingTemplates(true)
      try {
        const response = await fetch("/api/email-templates")
        const data = (await response.json()) as {
          templates?: EmailTemplateOption[]
          error?: string
        }

        if (!response.ok || !data.templates) {
          throw new Error(data.error ?? "Failed to load templates")
        }

        if (!isMounted) {
          return
        }

        setTemplates(data.templates)
        const firstTemplate = data.templates[0]
        if (firstTemplate) {
          setSelectedTemplateId((current) => current || firstTemplate.id)
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false)
        }
      }
    }

    void loadTemplates()

    return () => {
      isMounted = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setPreviewResult(null)
    }
  }, [isOpen])

  async function handlePreview() {
    if (!selectedTemplateId) {
      return
    }

    setIsRenderingPreview(true)
    try {
      const response = await fetch(`/api/email-templates/${selectedTemplateId}/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
        }),
      })

      const data = (await response.json()) as PreviewResult | { error: string }
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to render preview")
      }

      setPreviewResult(data)
    } catch (error) {
      console.error(error)
      onToast({ kind: "error", message: "Unable to render email preview right now." })
    } finally {
      setIsRenderingPreview(false)
    }
  }

  async function handleSend() {
    if (!selectedTemplateId) {
      onToast({ kind: "error", message: "Select a template first." })
      return
    }

    if (!previewResult) {
      onToast({ kind: "error", message: "Render preview before sending." })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          templateId: selectedTemplateId || null,
          subject: previewResult.subject,
          body: previewResult.body,
        }),
      })

      const data = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to send email")
      }

      onToast({ kind: "success", message: `Email sent to ${clientName}` })
      onSent()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email"
      onToast({ kind: "error", message })
    } finally {
      setIsSending(false)
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
        className="w-full max-w-[860px] rounded-[12px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-[#113238]">Email Client</h2>
            <p className="text-[12px] text-[#6b7280]">Template preview for {clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border-[0.5px] border-[#e5e7eb] px-2 py-1 text-[12px] text-[#113238]"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex items-end gap-3">
          <label className="flex-1 space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Template</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
              disabled={isLoadingTemplates}
            >
              {templates.length > 0 ? (
                templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.category})
                  </option>
                ))
              ) : (
                <option value="">
                  {isLoadingTemplates ? "Loading templates..." : "No templates available"}
                </option>
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={!selectedTemplateId || isRenderingPreview}
            className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
          >
            {isRenderingPreview ? "Rendering..." : "Preview"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Subject</p>
            <p className="text-[13px] text-[#113238]">
              {previewResult?.subject ?? selectedTemplate?.subject ?? "No preview loaded."}
            </p>
          </div>
          <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Body</p>
            {previewResult ? (
              <div
                className="max-h-[300px] overflow-auto text-[13px] text-[#113238]"
                dangerouslySetInnerHTML={{ __html: previewResult.body }}
              />
            ) : (
              <p className="text-[13px] text-[#113238]">No preview loaded.</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#113238]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending || !previewResult}
            title={!previewResult ? "Render preview first." : undefined}
            className="rounded-[8px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-3 py-2 text-[12px] text-white disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
