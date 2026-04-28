import { NextResponse } from "next/server"

import {
  loadIncomeItemSnapshot,
  responseId,
  routeParamId,
  type ClientRouteContext,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"

const INCOME_TYPE_VALUES = [
  "salary",
  "pension_super",
  "pension_government",
  "rental",
  "dividends",
  "interest",
  "business",
  "centrelink",
  "other",
] as const

const VALID_INCOME_TYPES = new Set<string>(INCOME_TYPE_VALUES)
const VALID_FREQUENCIES = new Set<string>(["weekly", "fortnightly", "monthly", "quarterly", "annually"])

function mapFrequency(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "annual") {
    return "annually"
  }

  return VALID_FREQUENCIES.has(normalized) ? normalized : null
}

function mapIncomeItem(item: {
  id: string
  income_type: string
  description: string | null
  amount: { toNumber: () => number } | number
  frequency: string
  tax_treatment: string | null
  start_date: Date | null
}) {
  const amountValue =
    typeof item.amount === "number"
      ? item.amount
      : typeof item.amount?.toNumber === "function"
        ? item.amount.toNumber()
        : Number(item.amount ?? 0)

  return {
    id: item.id,
    incomeType: item.income_type,
    description: item.description,
    amount: amountValue,
    frequency: item.frequency,
    isGross: item.tax_treatment !== "tax_free",
    effectiveDate: item.start_date?.toISOString() ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const items = await db.income_item.findMany({
      where: {
        owner_party_id: id,
      },
      orderBy: {
        created_at: "desc",
      },
    })

    return NextResponse.json(items.map((item) => mapIncomeItem(item)))
  } catch (error) {
    console.error("[income list error]", error)
    return NextResponse.json({ error: "failed to fetch income items" }, { status: 500 })
  }
}

async function createIncomeItem(
  request: Request,
  { params }: ClientRouteContext,
) {
  const { id } = await params
  const { incomeType, description, amount, frequency, isGross } = await request.json()

  if (typeof incomeType !== "string" || !VALID_INCOME_TYPES.has(incomeType)) {
    return NextResponse.json({ error: "invalid incomeType" }, { status: 400 })
  }

  const frequencyValue = mapFrequency(frequency)
  if (!frequencyValue) {
    return NextResponse.json({ error: "invalid frequency" }, { status: 400 })
  }

  const amountValue =
    typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : Number.NaN
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return NextResponse.json({ error: "amount must be greater than zero" }, { status: 400 })
  }

  try {
    const created = await db.income_item.create({
      data: {
        owner_party_id: id,
        income_type: incomeType,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        amount: amountValue,
        frequency: frequencyValue,
        tax_treatment: isGross === false ? "tax_free" : "taxable",
        start_date: new Date(),
      },
    })

    return NextResponse.json(mapIncomeItem(created))
  } catch (error) {
    console.error("[income create error]", error)
    return NextResponse.json({ error: "failed to create income item" }, { status: 500 })
  }
}

export const POST = withAuditTrail<ClientRouteContext>(createIncomeItem, {
  entity_type: "income_item",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const id = await responseId(auditContext)
    return id ? loadIncomeItemSnapshot(id) : null
  },
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
  metadataFn: async (_request, context) => ({
    owner_party_id: await routeParamId(context),
  }),
})
