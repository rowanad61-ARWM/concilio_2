import { NextResponse } from "next/server"

import { db } from "@/lib/db"

const LIABILITY_TYPES = [
  "home_loan",
  "investment_loan",
  "personal_loan",
  "car_loan",
  "credit_card",
  "margin_loan",
  "business_loan",
  "other",
] as const
const REPAYMENT_FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const

const VALID_LIABILITY_TYPES = new Set<string>(LIABILITY_TYPES)
const VALID_REPAYMENT_FREQUENCIES = new Set<string>(REPAYMENT_FREQUENCIES)

function numericValue(input: unknown) {
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

function mapLiability(item: {
  id: string
  liability_type: string
  purpose: string | null
  notes: string | null
  balance: unknown
  interest_rate: unknown
  repayment_amount: unknown
  repayment_frequency: string | null
}) {
  return {
    id: item.id,
    liabilityType: item.liability_type,
    description: item.purpose ?? item.notes,
    currentBalance: mapDecimal(item.balance),
    interestRate: item.interest_rate === null ? null : mapDecimal(item.interest_rate),
    repaymentAmount: item.repayment_amount === null ? null : mapDecimal(item.repayment_amount),
    repaymentFrequency: item.repayment_frequency,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const liabilities = await db.liability.findMany({
      where: {
        owner_party_id: id,
      },
      orderBy: {
        created_at: "desc",
      },
    })

    return NextResponse.json(liabilities.map((item) => mapLiability(item)))
  } catch (error) {
    console.error("[liabilities list error]", error)
    return NextResponse.json({ error: "failed to fetch liabilities" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const {
    liabilityType,
    description,
    currentBalance,
    interestRate,
    repaymentAmount,
    repaymentFrequency,
  } = await request.json()

  if (typeof liabilityType !== "string" || !VALID_LIABILITY_TYPES.has(liabilityType)) {
    return NextResponse.json({ error: "invalid liabilityType" }, { status: 400 })
  }

  const currentBalanceValue = numericValue(currentBalance)
  if (!Number.isFinite(currentBalanceValue) || currentBalanceValue <= 0) {
    return NextResponse.json({ error: "currentBalance must be greater than zero" }, { status: 400 })
  }

  const interestRateValue = interestRate === null || interestRate === undefined ? null : numericValue(interestRate)
  if (interestRateValue !== null && !Number.isFinite(interestRateValue)) {
    return NextResponse.json({ error: "invalid interestRate" }, { status: 400 })
  }

  const repaymentAmountValue =
    repaymentAmount === null || repaymentAmount === undefined ? null : numericValue(repaymentAmount)
  if (repaymentAmountValue !== null && !Number.isFinite(repaymentAmountValue)) {
    return NextResponse.json({ error: "invalid repaymentAmount" }, { status: 400 })
  }

  const repaymentFrequencyValue =
    typeof repaymentFrequency === "string" && repaymentFrequency.trim()
      ? repaymentFrequency.trim().toLowerCase()
      : null
  if (
    repaymentFrequencyValue &&
    !VALID_REPAYMENT_FREQUENCIES.has(repaymentFrequencyValue)
  ) {
    return NextResponse.json({ error: "invalid repaymentFrequency" }, { status: 400 })
  }

  try {
    const created = await db.liability.create({
      data: {
        owner_party_id: id,
        liability_type: liabilityType,
        lender: "Unknown lender",
        balance: currentBalanceValue,
        interest_rate: interestRateValue,
        repayment_amount: repaymentAmountValue,
        repayment_frequency: repaymentFrequencyValue,
        purpose: typeof description === "string" && description.trim() ? description.trim() : null,
        balance_as_at: new Date(),
      },
    })

    return NextResponse.json(mapLiability(created))
  } catch (error) {
    console.error("[liabilities create error]", error)
    return NextResponse.json({ error: "failed to create liability" }, { status: 500 })
  }
}

