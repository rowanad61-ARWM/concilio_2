import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { ENGAGEMENT_TYPE_VALUES, mapEngagementRow } from "@/lib/engagement"

const PLACEHOLDER_PRIMARY_ADVISER_ID = "00000000-0000-0000-0000-000000000001"
const VALID_ENGAGEMENT_TYPES = new Set<string>(ENGAGEMENT_TYPE_VALUES)

type ColumnRow = {
  column_name: string
}

type ConstraintRow = {
  definition: string
}

function extractConstraintValues(definition: string) {
  const matches = definition.matchAll(/'([^']+)'/g)
  const values = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      values.add(match[1])
    }
  }

  return [...values]
}

async function getEngagementColumns() {
  const rows = await db.$queryRawUnsafe<ColumnRow[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'engagement'`,
  )

  return new Set(rows.map((row) => row.column_name))
}

async function getDefaultStatusValue() {
  const rows = await db.$queryRawUnsafe<ConstraintRow[]>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'engagement'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%status%'`,
  )

  const options = rows.flatMap((row) => extractConstraintValues(row.definition))

  if (options.includes("active")) {
    return "active"
  }

  if (options.includes("open")) {
    return "open"
  }

  return options[0] ?? "active"
}

export async function POST(request: Request) {
  const { householdId, engagementType, title, description } = await request.json()

  if (
    typeof householdId !== "string" ||
    typeof engagementType !== "string" ||
    typeof title !== "string" ||
    !householdId.trim() ||
    !title.trim()
  ) {
    return NextResponse.json(
      { error: "householdId, engagementType and title are required" },
      { status: 400 },
    )
  }

  if (!VALID_ENGAGEMENT_TYPES.has(engagementType)) {
    return NextResponse.json({ error: "invalid engagementType" }, { status: 400 })
  }

  const descriptionValue = typeof description === "string" ? description.trim() : ""

  try {
    const columns = await getEngagementColumns()
    const statusValue = await getDefaultStatusValue()
    const now = new Date()

    const insertColumns = ["household_id", "engagement_type", "status", "primary_adviser_id"]
    const insertValues: unknown[] = [
      householdId.trim(),
      engagementType,
      statusValue,
      PLACEHOLDER_PRIMARY_ADVISER_ID,
    ]

    if (columns.has("title")) {
      insertColumns.push("title")
      insertValues.push(title.trim())
    }

    if (columns.has("description")) {
      insertColumns.push("description")
      insertValues.push(descriptionValue || null)
    }

    if (columns.has("notes")) {
      insertColumns.push("notes")
      insertValues.push(descriptionValue ? `${title.trim()}\n\n${descriptionValue}` : title.trim())
    }

    if (columns.has("started_at")) {
      insertColumns.push("started_at")
      insertValues.push(now)
    }

    if (columns.has("opened_at")) {
      insertColumns.push("opened_at")
      insertValues.push(now)
    }

    if (columns.has("created_at")) {
      insertColumns.push("created_at")
      insertValues.push(now)
    }

    if (columns.has("updated_at")) {
      insertColumns.push("updated_at")
      insertValues.push(now)
    }

    const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ")
    const quotedColumns = insertColumns.map((column) => `"${column}"`).join(", ")

    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `INSERT INTO engagement (${quotedColumns})
       VALUES (${placeholders})
       RETURNING *`,
      ...insertValues,
    )

    if (!rows[0]) {
      return NextResponse.json({ error: "failed to create engagement" }, { status: 500 })
    }

    return NextResponse.json(mapEngagementRow(rows[0]))
  } catch (error) {
    console.error("[engagement create error]", error)
    return NextResponse.json({ error: "failed to create engagement" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const householdId = searchParams.get("householdId")

  if (!householdId) {
    return NextResponse.json({ error: "householdId is required" }, { status: 400 })
  }

  try {
    const columns = await getEngagementColumns()
    const orderBy = columns.has("created_at")
      ? "created_at"
      : columns.has("started_at")
        ? "started_at"
        : columns.has("opened_at")
          ? "opened_at"
          : "id"

    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT *
       FROM engagement
       WHERE household_id = $1
       ORDER BY "${orderBy}" DESC`,
      householdId,
    )

    return NextResponse.json(rows.map((row) => mapEngagementRow(row)))
  } catch (error) {
    console.error("[engagement list error]", error)
    return NextResponse.json({ error: "failed to fetch engagements" }, { status: 500 })
  }
}

