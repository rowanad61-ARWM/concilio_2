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

type WorkflowTemplateRow = {
  id: string
  version: number
  stages: unknown
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

function readStageKey(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const stage = value as Record<string, unknown>
  return typeof stage.key === "string" && stage.key.trim() ? stage.key.trim() : null
}

function parseTemplateStages(stages: unknown) {
  if (!stages) {
    return []
  }

  let rawStages: unknown = stages
  if (typeof rawStages === "string") {
    try {
      rawStages = JSON.parse(rawStages)
    } catch {
      return []
    }
  }

  return Array.isArray(rawStages) ? rawStages : []
}

async function getTableColumns(tableName: string) {
  const rows = await db.$queryRawUnsafe<ColumnRow[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    tableName,
  )

  return new Set(rows.map((row) => row.column_name))
}

async function getDefaultStatusValue(tableName: string, preferredStatus: string, fallbackStatus: string) {
  const rows = await db.$queryRawUnsafe<ConstraintRow[]>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = $1
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%status%'`,
    tableName,
  )

  const options = rows.flatMap((row) => extractConstraintValues(row.definition))

  if (options.includes(preferredStatus)) {
    return preferredStatus
  }

  if (options.includes(fallbackStatus)) {
    return fallbackStatus
  }

  return options[0] ?? preferredStatus
}

async function getEngagementRowsByHousehold(householdId: string, orderBy: string) {
  return db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT
       e.*,
       wi.id AS workflow_instance_id,
       wi.current_stage AS workflow_current_stage,
       wi.status AS workflow_status,
       wt.stages AS workflow_template_stages
     FROM engagement e
     LEFT JOIN LATERAL (
       SELECT wi_inner.*
       FROM workflow_instance wi_inner
       WHERE wi_inner.engagement_id = e.id
       ORDER BY wi_inner.created_at DESC
       LIMIT 1
     ) wi ON true
     LEFT JOIN workflow_template wt ON wt.id = wi.template_id
     WHERE e.household_id = $1
     ORDER BY e."${orderBy}" DESC`,
    householdId,
  )
}

export async function POST(request: Request) {
  const { householdId, engagementType, title, description, templateId } = await request.json()

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
  const templateIdValue = typeof templateId === "string" && templateId.trim() ? templateId.trim() : null

  try {
    const [engagementColumns, workflowInstanceColumns] = await Promise.all([
      getTableColumns("engagement"),
      getTableColumns("workflow_instance"),
    ])
    const engagementStatusValue = await getDefaultStatusValue("engagement", "active", "open")
    const now = new Date()

    const insertColumns = ["household_id", "engagement_type", "status", "primary_adviser_id"]
    const insertValues: unknown[] = [
      householdId.trim(),
      engagementType,
      engagementStatusValue,
      PLACEHOLDER_PRIMARY_ADVISER_ID,
    ]

    if (engagementColumns.has("title")) {
      insertColumns.push("title")
      insertValues.push(title.trim())
    }

    if (engagementColumns.has("description")) {
      insertColumns.push("description")
      insertValues.push(descriptionValue || null)
    }

    if (engagementColumns.has("notes")) {
      insertColumns.push("notes")
      insertValues.push(descriptionValue ? `${title.trim()}\n\n${descriptionValue}` : title.trim())
    }

    if (engagementColumns.has("started_at")) {
      insertColumns.push("started_at")
      insertValues.push(now)
    }

    if (engagementColumns.has("opened_at")) {
      insertColumns.push("opened_at")
      insertValues.push(now)
    }

    if (engagementColumns.has("created_at")) {
      insertColumns.push("created_at")
      insertValues.push(now)
    }

    if (engagementColumns.has("updated_at")) {
      insertColumns.push("updated_at")
      insertValues.push(now)
    }

    const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ")
    const quotedColumns = insertColumns.map((column) => `"${column}"`).join(", ")

    const engagementRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `INSERT INTO engagement (${quotedColumns})
       VALUES (${placeholders})
       RETURNING *`,
      ...insertValues,
    )

    if (!engagementRows[0]) {
      return NextResponse.json({ error: "failed to create engagement" }, { status: 500 })
    }

    const createdEngagement = engagementRows[0]

    if (templateIdValue) {
      const templateRows = await db.$queryRawUnsafe<WorkflowTemplateRow[]>(
        `SELECT id, version, stages
         FROM workflow_template
         WHERE id = $1
         LIMIT 1`,
        templateIdValue,
      )

      const template = templateRows[0]
      if (!template) {
        return NextResponse.json({ error: "workflow template not found" }, { status: 400 })
      }

      const stages = parseTemplateStages(template.stages)
      const firstStage = readStageKey(stages[0])

      if (!firstStage) {
        return NextResponse.json({ error: "workflow template has no valid stages" }, { status: 400 })
      }

      const workflowStatusValue = await getDefaultStatusValue("workflow_instance", "active", "active")
      const workflowInsertColumns = [
        "template_id",
        "template_version",
        "engagement_id",
        "household_id",
        "current_stage",
        "status",
      ]
      const workflowInsertValues: unknown[] = [
        template.id,
        template.version,
        createdEngagement.id,
        householdId.trim(),
        firstStage,
        workflowStatusValue,
      ]

      if (workflowInstanceColumns.has("started_at")) {
        workflowInsertColumns.push("started_at")
        workflowInsertValues.push(now)
      }

      if (workflowInstanceColumns.has("last_event_at")) {
        workflowInsertColumns.push("last_event_at")
        workflowInsertValues.push(now)
      }

      if (workflowInstanceColumns.has("context_data")) {
        workflowInsertColumns.push("context_data")
        workflowInsertValues.push("{}")
      }

      if (workflowInstanceColumns.has("created_at")) {
        workflowInsertColumns.push("created_at")
        workflowInsertValues.push(now)
      }

      if (workflowInstanceColumns.has("updated_at")) {
        workflowInsertColumns.push("updated_at")
        workflowInsertValues.push(now)
      }

      const workflowPlaceholders = workflowInsertValues.map((_, index) => `$${index + 1}`).join(", ")
      const workflowQuotedColumns = workflowInsertColumns.map((column) => `"${column}"`).join(", ")

      const workflowRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        `INSERT INTO workflow_instance (${workflowQuotedColumns})
         VALUES (${workflowPlaceholders})
         RETURNING id, current_stage, status`,
        ...workflowInsertValues,
      )
      const createdWorkflow = workflowRows[0]

      if (createdWorkflow) {
        createdEngagement.workflow_instance_id = createdWorkflow.id
        createdEngagement.workflow_current_stage = createdWorkflow.current_stage
        createdEngagement.workflow_status = createdWorkflow.status
        createdEngagement.workflow_template_stages = template.stages
      }
    }

    return NextResponse.json(mapEngagementRow(createdEngagement))
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
    const columns = await getTableColumns("engagement")
    const orderBy = columns.has("created_at")
      ? "created_at"
      : columns.has("started_at")
        ? "started_at"
        : columns.has("opened_at")
          ? "opened_at"
          : "id"

    const rows = await getEngagementRowsByHousehold(householdId, orderBy)
    return NextResponse.json(rows.map((row) => mapEngagementRow(row)))
  } catch (error) {
    console.error("[engagement list error]", error)
    return NextResponse.json({ error: "failed to fetch engagements" }, { status: 500 })
  }
}
