"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type EmailTemplateRow = {
  id: string
  name: string
  category: string
  subject: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ClientOption = {
  id: string
  displayName: string
}

type PreviewResult = {
  subject: string
  body: string
}

type EmailTemplatesListProps = {
  templates: EmailTemplateRow[]
  clients: ClientOption[]
}

export default function EmailTemplatesList({ templates, clients }: EmailTemplatesListProps) {
  const router = useRouter()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateRow | null>(null)
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "")
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  const hasClients = clients.length > 0
  const canRenderPreview = Boolean(selectedTemplate && selectedClientId)

  const selectedClientName = useMemo(
    () => clients.find((client) => client.id === selectedClientId)?.displayName ?? "No client selected",
    [clients, selectedClientId],
  )

  function openPreview(template: EmailTemplateRow) {
    setSelectedTemplate(template)
    setPreviewResult(null)
    setSelectedClientId((current) => current || clients[0]?.id || "")
    setIsPreviewOpen(true)
  }

  function closePreview() {
    setIsPreviewOpen(false)
    setPreviewResult(null)
    setIsLoadingPreview(false)
    setSelectedTemplate(null)
  }

  async function handleRenderPreview() {
    if (!selectedTemplate || !selectedClientId) {
      return
    }

    setIsLoadingPreview(true)
    try {
      const response = await fetch(`/api/email-templates/${selectedTemplate.id}/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: selectedClientId }),
      })

      const data = (await response.json()) as PreviewResult | { error: string }
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to render preview")
      }

      setPreviewResult(data)
    } catch (error) {
      console.error(error)
      alert("Unable to render preview right now.")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Archive this template?")
    if (!confirmed) {
      return
    }

    setIsDeletingId(id)
    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to archive template")
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert("Unable to archive template right now.")
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#113238]">Email Templates</h1>
          <p className="text-[12px] text-[#6b7280]">Manage reusable templates with merge fields.</p>
        </div>
        <Link
          href="/email-templates/new"
          className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-3 py-2 text-[12px] text-white"
        >
          New Template
        </Link>
      </div>

      <div className="overflow-hidden rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#FAFBFC]">
            <tr className="text-left text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id} className="border-t-[0.5px] border-[#e5e7eb] text-[13px] text-[#113238]">
                <td className="px-4 py-3 font-medium">{template.name}</td>
                <td className="px-4 py-3">{template.category}</td>
                <td className="px-4 py-3">{template.subject}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/email-templates/${template.id}`}
                      className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-2 py-1 text-[12px]"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => openPreview(template)}
                      className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-2 py-1 text-[12px]"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(template.id)}
                      disabled={isDeletingId === template.id}
                      className="rounded-[7px] border-[0.5px] border-[#F4C7C7] bg-white px-2 py-1 text-[12px] text-[#E24B4A] disabled:opacity-60"
                    >
                      {isDeletingId === template.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-[#9ca3af]">
                  No active templates yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,50,56,0.36)] p-4"
          onClick={closePreview}
        >
          <div
            className="w-full max-w-[860px] rounded-[12px] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-[#113238]">
                  Preview: {selectedTemplate?.name ?? "Template"}
                </h2>
                <p className="text-[12px] text-[#6b7280]">Select a client to render merge fields.</p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-[6px] border-[0.5px] border-[#e5e7eb] px-2 py-1 text-[12px] text-[#113238]"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex items-end gap-3">
              <label className="flex-1 space-y-1">
                <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Client</span>
                <select
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
                >
                  {hasClients ? (
                    clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.displayName}
                      </option>
                    ))
                  ) : (
                    <option value="">No clients available</option>
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleRenderPreview()}
                disabled={!canRenderPreview || isLoadingPreview}
                className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
              >
                {isLoadingPreview ? "Rendering..." : "Render Preview"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Rendered subject</p>
                <p className="text-[13px] text-[#113238]">{previewResult?.subject ?? "No preview yet."}</p>
                <p className="mt-3 text-[11px] text-[#9ca3af]">Client: {selectedClientName}</p>
              </div>
              <div className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Rendered body</p>
                {previewResult ? (
                  <div
                    className="max-h-[320px] overflow-auto text-[13px] text-[#113238]"
                    dangerouslySetInnerHTML={{ __html: previewResult.body }}
                  />
                ) : (
                  <p className="text-[13px] text-[#113238]">No preview yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

