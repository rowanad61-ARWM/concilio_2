"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { MERGE_FIELD_TOKENS } from "@/lib/mergeFields"

type TemplateCategory = "SOA" | "ROA" | "Appointment" | "Annual Review"

const categoryOptions: TemplateCategory[] = ["SOA", "ROA", "Appointment", "Annual Review"]

type TemplateForm = {
  id?: string
  name: string
  category: string
  subject: string
  body: string
}

type EmailTemplateEditorProps = {
  mode: "create" | "edit"
  template?: TemplateForm
}

export default function EmailTemplateEditor({ mode, template }: EmailTemplateEditorProps) {
  const router = useRouter()
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [name, setName] = useState(template?.name ?? "")
  const [category, setCategory] = useState(template?.category ?? categoryOptions[0])
  const [subject, setSubject] = useState(template?.subject ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const [activeField, setActiveField] = useState<"subject" | "body">("subject")
  const [isSaving, setIsSaving] = useState(false)

  const pageTitle = useMemo(
    () => (mode === "create" ? "New Email Template" : "Edit Email Template"),
    [mode],
  )

  function insertToken(token: string) {
    const subjectInput = subjectRef.current
    const bodyInput = bodyRef.current

    if (activeField === "subject" && subjectInput) {
      const start = subjectInput.selectionStart ?? subject.length
      const end = subjectInput.selectionEnd ?? subject.length
      const updated = `${subject.slice(0, start)}${token}${subject.slice(end)}`
      setSubject(updated)

      requestAnimationFrame(() => {
        subjectInput.focus()
        const cursor = start + token.length
        subjectInput.setSelectionRange(cursor, cursor)
      })
      return
    }

    if (bodyInput) {
      const start = bodyInput.selectionStart ?? body.length
      const end = bodyInput.selectionEnd ?? body.length
      const updated = `${body.slice(0, start)}${token}${body.slice(end)}`
      setBody(updated)

      requestAnimationFrame(() => {
        bodyInput.focus()
        const cursor = start + token.length
        bodyInput.setSelectionRange(cursor, cursor)
      })
    }
  }

  async function handleSave() {
    if (!name.trim() || !category.trim() || !subject.trim() || !body.trim()) {
      alert("Please complete all fields.")
      return
    }

    setIsSaving(true)
    try {
      const endpoint =
        mode === "create" ? "/api/email-templates" : `/api/email-templates/${template?.id ?? ""}`
      const method = mode === "create" ? "POST" : "PUT"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          category,
          subject,
          body,
        }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save template")
      }

      router.push("/email-templates")
      router.refresh()
    } catch (error) {
      console.error(error)
      alert("Unable to save template right now.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#113238]">{pageTitle}</h1>
          <p className="text-[12px] text-[#6b7280]">Create and manage HTML templates with merge fields.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/email-templates")}
          className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#113238]"
        >
          Back to list
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_280px]">
        <div className="space-y-4 rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-4">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Subject</span>
            <input
              ref={subjectRef}
              value={subject}
              onFocus={() => setActiveField("subject")}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-[0.5px] text-[#9ca3af]">Body (HTML)</span>
            <textarea
              ref={bodyRef}
              value={body}
              onFocus={() => setActiveField("body")}
              onChange={(event) => setBody(event.target.value)}
              rows={16}
              className="w-full rounded-[8px] border-[0.5px] border-[#e5e7eb] px-3 py-2 text-[13px] text-[#113238]"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-[8px] border-[0.5px] border-[#113238] bg-[#113238] px-3 py-2 text-[12px] text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Template"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/email-templates")}
              className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#113238]"
            >
              Cancel
            </button>
          </div>
        </div>

        <aside className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-[#113238]">Merge Fields</h2>
          <p className="mt-1 text-[11px] text-[#6b7280]">
            Click a field to insert at the current cursor in subject/body.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MERGE_FIELD_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertToken(token)}
                className="rounded-[999px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] px-2 py-1 text-[11px] text-[#113238]"
              >
                {token}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-[#9ca3af]">
            Active field: <span className="font-medium text-[#113238]">{activeField}</span>
          </p>
        </aside>
      </div>
    </div>
  )
}

