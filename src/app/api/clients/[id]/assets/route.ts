import { NextResponse } from "next/server"

import {
  loadFinancialAccountSnapshot,
  loadPropertyAssetSnapshot,
  responseItemId,
  responseJson,
  routeParamId,
  type ClientRouteContext,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"

const PROPERTY_USAGE_TYPES = [
  "owner_occupied",
  "investment",
  "holiday",
  "commercial",
  "rural",
  "other",
] as const
const ACCOUNT_TYPES = [
  "bank",
  "term_deposit",
  "wrap_platform",
  "super_accumulation",
  "super_pension",
  "direct_shares",
  "managed_fund",
  "insurance",
  "loan",
  "credit_card",
  "other",
] as const

const VALID_PROPERTY_USAGE_TYPES = new Set<string>(PROPERTY_USAGE_TYPES)
const VALID_ACCOUNT_TYPES = new Set<string>(ACCOUNT_TYPES)

function numberValue(input: unknown) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : Number.NaN
  }

  if (typeof input === "string") {
    const parsed = Number(input)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  return Number.NaN
}

function mapDecimal(value: unknown) {
  if (typeof value === "number") {
    return value
  }

  if (value && typeof value === "object" && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber()
  }

  return Number(value ?? 0)
}

function mapAddress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      line1: null,
      suburb: null,
      state: null,
      postcode: null,
    }
  }

  const address = value as Record<string, unknown>

  return {
    line1: typeof address.line1 === "string" ? address.line1 : null,
    suburb: typeof address.suburb === "string" ? address.suburb : null,
    state: typeof address.state === "string" ? address.state : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const [propertyAssets, financialAccounts] = await Promise.all([
      db.$queryRawUnsafe<
        {
          id: string
          address: unknown
          usage_type: string | null
          current_value: unknown
        }[]
      >(
        `SELECT pa.id, pa.address, pa.usage_type, pa.current_value
         FROM property_asset pa
         JOIN ownership_interest oi
           ON oi.target_id = pa.id
          AND oi.owner_party_id = $1
          AND oi.end_date IS NULL
          AND oi.target_type IN ('property', 'property_asset')
         ORDER BY pa.created_at DESC`,
        id,
      ),
      db.financial_account.findMany({
        where: {
          owner_party_id: id,
        },
        orderBy: {
          created_at: "desc",
        },
      }),
    ])

    return NextResponse.json({
      propertyAssets: propertyAssets.map((asset) => ({
        id: asset.id,
        address: mapAddress(asset.address),
        usageType: asset.usage_type,
        currentValue: mapDecimal(asset.current_value),
      })),
      financialAccounts: financialAccounts.map((account) => ({
        id: account.id,
        accountType: account.account_type,
        currentBalance: mapDecimal(account.current_balance),
        institutionName: account.provider_name,
      })),
    })
  } catch (error) {
    console.error("[assets list error]", error)
    return NextResponse.json({ error: "failed to fetch assets" }, { status: 500 })
  }
}

async function createAsset(
  request: Request,
  { params }: ClientRouteContext,
) {
  const { id } = await params
  const body = await request.json()

  try {
    if (body?.type === "property") {
      const usageType = typeof body.usageType === "string" ? body.usageType : ""
      const currentValue = numberValue(body.currentValue)

      if (!VALID_PROPERTY_USAGE_TYPES.has(usageType)) {
        return NextResponse.json({ error: "invalid usageType" }, { status: 400 })
      }

      if (!Number.isFinite(currentValue) || currentValue <= 0) {
        return NextResponse.json({ error: "currentValue must be greater than zero" }, { status: 400 })
      }

      const address = {
        line1: typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "",
        suburb: typeof body.suburb === "string" ? body.suburb.trim() : "",
        state: typeof body.state === "string" ? body.state.trim() : "",
        postcode: typeof body.postcode === "string" ? body.postcode.trim() : "",
      }

      if (!address.line1 || !address.suburb || !address.state || !address.postcode) {
        return NextResponse.json(
          { error: "addressLine1, suburb, state and postcode are required" },
          { status: 400 },
        )
      }

      const createdProperty = await db.property_asset.create({
        data: {
          address,
          usage_type: usageType,
          current_value: currentValue,
          value_as_at: new Date(),
        },
      })

      await db.$executeRawUnsafe(
        `INSERT INTO ownership_interest (owner_party_id, target_type, target_id)
         VALUES ($1, 'property', $2)`,
        id,
        createdProperty.id,
      )

      return NextResponse.json({
        type: "property",
        item: {
          id: createdProperty.id,
          address: mapAddress(createdProperty.address),
          usageType: createdProperty.usage_type,
          currentValue: mapDecimal(createdProperty.current_value),
        },
      })
    }

    if (body?.type === "account") {
      const accountType = typeof body.accountType === "string" ? body.accountType : ""
      const currentBalance = numberValue(body.currentBalance)
      const institutionName = typeof body.institutionName === "string" ? body.institutionName.trim() : ""

      if (!VALID_ACCOUNT_TYPES.has(accountType)) {
        return NextResponse.json({ error: "invalid accountType" }, { status: 400 })
      }

      if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
        return NextResponse.json({ error: "currentBalance must be greater than zero" }, { status: 400 })
      }

      const createdAccount = await db.financial_account.create({
        data: {
          owner_party_id: id,
          account_type: accountType,
          provider_name: institutionName || "Unknown institution",
          current_balance: currentBalance,
          status: "active",
          balance_as_at: new Date(),
        },
      })

      return NextResponse.json({
        type: "account",
        item: {
          id: createdAccount.id,
          accountType: createdAccount.account_type,
          currentBalance: mapDecimal(createdAccount.current_balance),
          institutionName: createdAccount.provider_name,
        },
      })
    }

    return NextResponse.json({ error: "type must be property or account" }, { status: 400 })
  } catch (error) {
    console.error("[assets create error]", error)
    return NextResponse.json({ error: "failed to create asset" }, { status: 500 })
  }
}

type CreatedAssetResponse = {
  type?: string
  item?: {
    id?: string
  }
}

export const POST = withAuditTrail<ClientRouteContext>(createAsset, {
  entity_type: async (_request, _context, auditContext) => {
    const payload = await responseJson<CreatedAssetResponse>(auditContext)

    if (payload?.type === "property") {
      return "property_asset"
    }

    if (payload?.type === "account") {
      return "financial_account"
    }

    return "asset"
  },
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<CreatedAssetResponse>(auditContext)
    const id = payload?.item?.id

    if (!id) {
      return null
    }

    if (payload?.type === "property") {
      return loadPropertyAssetSnapshot(id)
    }

    if (payload?.type === "account") {
      return loadFinancialAccountSnapshot(id)
    }

    return null
  },
  entityIdFn: async (_request, _context, auditContext) => responseItemId(auditContext),
  metadataFn: async (_request, context, auditContext) => {
    const payload = await responseJson<CreatedAssetResponse>(auditContext)

    return {
      owner_party_id: await routeParamId(context),
      asset_type: payload?.type ?? null,
    }
  },
})
