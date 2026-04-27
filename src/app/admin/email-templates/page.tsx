import Link from "next/link"

import { db } from "@/lib/db"
import { MERGE_FIELD_TOKENS } from "@/lib/mergeFields"

export const dynamic = "force-dynamic"

function formatDate(value: Date) {
  return value.toISOString()
}

function previewBody(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized
}

function getUsedMergeFields(subject: string, body: string) {
  const normalizedContent = `${subject} ${body}`.replace(/\s+/g, "")

  return MERGE_FIELD_TOKENS.filter((token) => normalizedContent.includes(token.replace(/\s+/g, "")))
}

export default async function AdminEmailTemplatesPage() {
  const templates = await db.emailTemplate.findMany({
    orderBy: [
      { isActive: "desc" },
      { category: "asc" },
      { name: "asc" },
    ],
  })

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Email Templates</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {templates.length} templates
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Merge fields</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {templates.length > 0 ? (
              templates.map((template) => {
                const usedMergeFields = getUsedMergeFields(template.subject, template.body)

                return (
                  <tr key={template.id} className="border-t border-[#edf1f4] align-top hover:bg-[#FAFBFC]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/email-templates/${template.id}`}
                        className="font-medium text-[#113238] hover:underline"
                      >
                        {template.name}
                      </Link>
                      <p className="mt-1 font-mono text-[12px] text-[#6b7280]">{template.id}</p>
                    </td>
                    <td className="px-4 py-3 text-[#4b5563]">{template.category}</td>
                    <td className="max-w-[360px] px-4 py-3 text-[#4b5563]">
                      <p className="font-medium text-[#113238]">{template.subject}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">{previewBody(template.body)}</p>
                    </td>
                    <td className="max-w-[300px] px-4 py-3">
                      {usedMergeFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {usedMergeFields.map((token) => (
                            <span
                              key={token}
                              className="rounded-[999px] bg-[#EAF0F1] px-2 py-1 font-mono text-[11px] text-[#185F68]"
                            >
                              {token}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#9ca3af]">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-[999px] bg-[#EAF0F1] px-2 py-1 text-[11px] text-[#4b5563]">
                        {template.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4b5563]">{formatDate(template.updatedAt)}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">
                  No email templates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
