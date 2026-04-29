import { NextResponse } from "next/server"

import {
  loadCentrelinkDetailSnapshot,
  responseId,
  routeParamId,
  type ClientRouteContext,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS,
  coerceEmptyToNull,
} from "@/lib/input-coercion"

function hasAnyProperty(source: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key))
}

function valueFor(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key]
    }
  }

  return undefined
}

function assignIfPresent(
  target: Record<string, unknown>,
  column: string,
  source: Record<string, unknown>,
  keys: string[],
) {
  if (hasAnyProperty(source, keys)) {
    target[column] = valueFor(source, keys) ?? null
  }
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off", ""].includes(normalized)) return false
  }

  return null
}

function assignBooleanIfPresent(
  target: Record<string, unknown>,
  column: string,
  source: Record<string, unknown>,
  keys: string[],
) {
  if (!hasAnyProperty(source, keys)) {
    return null
  }

  const parsed = booleanValue(valueFor(source, keys))
  if (parsed === null) {
    return column
  }

  target[column] = parsed
  return null
}

async function upsertCentrelinkDetail(
  request: Request,
  { params }: ClientRouteContext,
) {
  const { id } = await params
  const body = (await request.json()) as Record<string, unknown>
  const detailData: Record<string, unknown> = {}

  assignIfPresent(detailData, "benefit_type", body, ["benefit_type", "benefitType"])
  assignIfPresent(detailData, "crn", body, ["crn", "CRN"])
  assignIfPresent(detailData, "concession_card_type", body, [
    "concession_card_type",
    "concessionCardType",
  ])
  assignIfPresent(detailData, "notes", body, ["notes"])

  const invalidBoolean =
    assignBooleanIfPresent(detailData, "is_eligible", body, ["is_eligible", "isEligible"]) ??
    assignBooleanIfPresent(detailData, "has_concession_card", body, [
      "has_concession_card",
      "hasConcessionCard",
    ]) ??
    assignBooleanIfPresent(detailData, "has_gifted_assets", body, [
      "has_gifted_assets",
      "hasGiftedAssets",
    ])

  if (invalidBoolean) {
    return NextResponse.json({ error: `invalid ${invalidBoolean}` }, { status: 400 })
  }

  const data = coerceEmptyToNull(
    detailData,
    CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS,
  )

  try {
    const person = await db.person.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!person) {
      return NextResponse.json({ error: "person not found" }, { status: 404 })
    }

    const existing = await db.centrelink_detail.findUnique({
      where: { person_id: id },
      select: { id: true },
    })

    const detail = existing
      ? await db.centrelink_detail.update({
          where: { person_id: id },
          data: {
            ...data,
            updated_at: new Date(),
          },
        })
      : await db.centrelink_detail.create({
          data: {
            person_id: id,
            ...data,
          },
        })

    return NextResponse.json(detail)
  } catch (error) {
    console.error("[centrelink detail upsert error]", error)
    return NextResponse.json({ error: "failed to save centrelink detail" }, { status: 500 })
  }
}

export const PATCH = withAuditTrail<ClientRouteContext>(upsertCentrelinkDetail, {
  entity_type: "centrelink_detail",
  action: async (_request, _context, auditContext) =>
    auditContext.beforeSnapshot ? "UPDATE" : "CREATE",
  beforeFn: async (_request, context) =>
    loadCentrelinkDetailSnapshot(await routeParamId(context)),
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseId(auditContext)
    if (!id) {
      return null
    }

    const payload = await auditContext.response?.clone().json().catch(() => null)
    const personId =
      payload && typeof payload.person_id === "string" ? payload.person_id : null

    return personId ? loadCentrelinkDetailSnapshot(personId) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
  metadataFn: async (_request, context) => ({
    person_id: await routeParamId(context),
  }),
})
