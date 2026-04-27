import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { db } from "@/lib/db"
import { MERGE_FIELD_TOKENS } from "@/lib/mergeFields"

export const dynamic = "force-dynamic"

type AdminEmailTemplateDetailPageProps = {
  params: Promise<{ id: string }>
}

const mergeFieldPattern = /{{\s*[^}]+?\s*}}/g

function formatDate(value: Date) {
  return value.toISOString()
}

function getUsedMergeFields(subject: string, body: string) {
  const normalizedContent = `${subject} ${body}`.replace(/\s+/g, "")

  return MERGE_FIELD_TOKENS.filter((token) => normalizedContent.includes(token.replace(/\s+/g, "")))
}

function renderHighlightedMergeFields(value: string) {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of value.matchAll(mergeFieldPattern)) {
    const token = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      nodes.push(value.slice(lastIndex, index))
    }

    nodes.push(
      <span key={`${token}-${index}`} className="rounded-[5px] bg-[#EAF0F1] px-1.5 py-0.5 font-mono text-[#185F68]">
        {token}
      </span>,
    )
    lastIndex = index + token.length
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : value
}

export default async function AdminEmailTemplateDetailPage({ params }: AdminEmailTemplateDetailPageProps) {
  const { id } = await params

  const template = await db.emailTemplate.findUnique({
    where: { id },
  })

  if (!template) {
    notFound()
  }

  const usedMergeFields = getUsedMergeFields(template.subject, template.body)

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">
            <Link href="/admin/email-templates" className="hover:underline">
              Email Templates
            </Link>
          </p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">{template.name}</h1>
          <p className="mt-1 font-mono text-[12px] text-[#4b5563]">{template.id}</p>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {template.isActive ? "Active" : "Archived"}
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Template metadata</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Category</dt>
            <dd className="mt-1 text-[#113238]">{template.category}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Channel</dt>
            <dd className="mt-1 text-[#113238]">{template.channel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Created</dt>
            <dd className="mt-1 text-[#113238]">{formatDate(template.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Updated</dt>
            <dd className="mt-1 text-[#113238]">{formatDate(template.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Merge fields</h2>
        </div>
        <div className="px-4 py-4">
          {usedMergeFields.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {usedMergeFields.map((token) => (
                <span key={token} className="rounded-[999px] bg-[#EAF0F1] px-2 py-1 font-mono text-[11px] text-[#185F68]">
                  {token}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#6b7280]">No merge fields are used by this template.</p>
          )}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Subject</h2>
        </div>
        <div className="px-4 py-4 text-[14px] font-medium text-[#113238]">
          {renderHighlightedMergeFields(template.subject)}
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Body</h2>
        </div>
        <div className="whitespace-pre-wrap px-4 py-4 text-[13px] leading-6 text-[#374151]">
          {renderHighlightedMergeFields(template.body)}
        </div>
      </section>
    </div>
  )
}
