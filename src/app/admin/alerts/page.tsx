import Link from "next/link"

import AlertAcknowledgeButton from "@/components/admin/AlertAcknowledgeButton"
import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

type AdminAlertsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    view?: string | string[]
  }>
}

type ClientLink = {
  href: string
  label: string
  detail?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function formatAbsoluteDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date)
}

function formatRelativeDate(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days}d ago`
  }

  return formatAbsoluteDate(date)
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "empty"
  }

  if (typeof value === "string") {
    return value
  }

  if (value instanceof Date) {
    return formatAbsoluteDate(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function readPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return {
      field: "unknown",
      oldValue: null,
      newValue: null,
    }
  }

  return {
    field: typeof payload.field === "string" ? payload.field : "unknown",
    oldValue: payload.old,
    newValue: payload.new,
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function isFileNoteReviewAlert(alert: { alert_type: string }) {
  return alert.alert_type === "file_note_review_outstanding"
}

function pageHref(page: number, view: string) {
  return `/admin/alerts?page=${page}&view=${view}`
}

export default async function AdminAlertsPage({
  searchParams,
}: AdminAlertsPageProps) {
  const adminUser = await requireAdmin()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const currentPage = parsePage(resolvedSearchParams.page)
  const view = firstQueryValue(resolvedSearchParams.view) === "mine" ? "mine" : "all"
  const skip = (currentPage - 1) * PAGE_SIZE
  const where = {
    acknowledged_at: null,
    cleared_at: null,
    ...(view === "mine" ? { recipient_user_id: adminUser.id } : {}),
  }

  const [alerts, totalUnacknowledged] = await Promise.all([
    db.alert_instance.findMany({
      where,
      orderBy: {
        occurred_at: "desc",
      },
      skip,
      take: PAGE_SIZE,
      include: {
        audit_event: {
          select: {
            actor_id: true,
            actor_type: true,
            occurred_at: true,
            request_id: true,
          },
        },
      },
    }),
    db.alert_instance.count({ where }),
  ])

  const personIds = uniqueStrings(
    alerts
      .filter((alert) => alert.entity_type === "person")
      .map((alert) => alert.entity_id),
  )
  const financialAccountIds = uniqueStrings(
    alerts
      .filter((alert) => alert.entity_type === "financial_account")
      .map((alert) => alert.entity_id),
  )
  const actorIds = uniqueStrings(alerts.map((alert) => alert.audit_event?.actor_id))

  const [personParties, financialAccounts, actorUsers] = await Promise.all([
    personIds.length
      ? db.party.findMany({
          where: { id: { in: personIds } },
          select: {
            id: true,
            display_name: true,
          },
        })
      : [],
    financialAccountIds.length
      ? db.financial_account.findMany({
          where: { id: { in: financialAccountIds } },
          select: {
            id: true,
            provider_name: true,
            account_name: true,
            party: {
              select: {
                id: true,
                display_name: true,
              },
            },
          },
        })
      : [],
    actorIds.length
      ? db.user_account.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [],
  ])

  const personClientById = new Map<string, ClientLink>()
  for (const party of personParties) {
    personClientById.set(party.id, {
      href: `/clients/${party.id}`,
      label: party.display_name,
    })
  }

  const financialClientByAccountId = new Map<string, ClientLink>()
  for (const account of financialAccounts) {
    financialClientByAccountId.set(account.id, {
      href: `/clients/${account.party.id}`,
      label: account.party.display_name,
      detail: account.account_name ?? account.provider_name,
    })
  }

  const actorById = new Map<string, { name: string; email: string }>()
  for (const user of actorUsers) {
    actorById.set(user.id, {
      name: user.name,
      email: user.email,
    })
  }
  const totalPages = Math.max(1, Math.ceil(totalUnacknowledged / PAGE_SIZE))

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">Admin</p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">Alerts</h1>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {totalUnacknowledged} outstanding
        </div>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        {alerts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-medium text-[#113238]">No outstanding alerts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
              <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">Changed by</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const payload = readPayload(alert.payload)
                  const payloadRecord = isRecord(alert.payload) ? alert.payload : {}
                  const fileNoteClientId = stringValue(payloadRecord.client_id)
                  const fileNoteReviewUrl = stringValue(payloadRecord.review_url)
                  const fileNoteClientName = stringValue(payloadRecord.client_name)
                  const client = isFileNoteReviewAlert(alert)
                    ? fileNoteClientId && fileNoteClientName
                      ? {
                          href: `/clients/${fileNoteClientId}`,
                          label: fileNoteClientName,
                        }
                      : null
                    : alert.entity_type === "financial_account"
                      ? financialClientByAccountId.get(alert.entity_id)
                      : personClientById.get(alert.entity_id)
                  const actorUser = alert.audit_event?.actor_id
                    ? actorById.get(alert.audit_event.actor_id)
                    : null
                  const changedBy =
                    actorUser?.name ??
                    actorUser?.email ??
                    alert.audit_event?.actor_type ??
                    "Unknown"

                  return (
                    <tr key={alert.id} className="border-t border-[#edf1f4] hover:bg-[#FAFBFC]">
                      <td className="whitespace-nowrap px-4 py-3 text-[#4b5563]">
                        <span title={formatAbsoluteDate(alert.occurred_at)}>
                          {formatRelativeDate(alert.occurred_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {client ? (
                          <div>
                            <Link
                              href={client.href}
                              className="font-medium text-[#185F68] underline-offset-2 hover:underline"
                            >
                              {client.label}
                            </Link>
                            {client.detail ? (
                              <p className="mt-0.5 text-[11px] text-[#6b7280]">{client.detail}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[#6b7280]">Unknown client</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#113238]">
                        {isFileNoteReviewAlert(alert) ? "File note awaiting review" : payload.field}
                      </td>
                      <td className="px-4 py-3 text-[#4b5563]">
                        {isFileNoteReviewAlert(alert) ? (
                          <div className="flex flex-col gap-1">
                            <span>Review work is ready.</span>
                            {fileNoteReviewUrl ? (
                              <Link
                                href={fileNoteReviewUrl}
                                className="font-medium text-[#185F68] underline-offset-2 hover:underline"
                              >
                                Open review screen
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-[#113238]">
                              {formatJsonValue(payload.oldValue)}
                            </span>
                            <span className="mx-2 text-[#9ca3af]">-&gt;</span>
                            <span className="font-medium text-[#113238]">
                              {formatJsonValue(payload.newValue)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#4b5563]">{changedBy}</td>
                      <td className="px-4 py-3">
                        <AlertAcknowledgeButton alertId={alert.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between text-[12px] text-[#6b7280]">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            href="/admin/alerts?page=1&view=mine"
            className={`rounded-[7px] border px-3 py-2 font-medium ${
              view === "mine"
                ? "border-[#185F68] bg-[#EAF0F1] text-[#185F68]"
                : "border-[#d9e2e7] bg-white text-[#113238] hover:bg-[#EAF0F1]"
            }`}
          >
            My alerts
          </Link>
          <Link
            href="/admin/alerts?page=1&view=all"
            className={`rounded-[7px] border px-3 py-2 font-medium ${
              view === "all"
                ? "border-[#185F68] bg-[#EAF0F1] text-[#185F68]"
                : "border-[#d9e2e7] bg-white text-[#113238] hover:bg-[#EAF0F1]"
            }`}
          >
            All alerts
          </Link>
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1, view)}
              className="rounded-[7px] border border-[#d9e2e7] bg-white px-3 py-2 font-medium text-[#113238] hover:bg-[#EAF0F1]"
            >
              Previous
            </Link>
          ) : null}
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1, view)}
              className="rounded-[7px] border border-[#d9e2e7] bg-white px-3 py-2 font-medium text-[#113238] hover:bg-[#EAF0F1]"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
