import { NextResponse } from "next/server"

import {
  responseId,
  type ClientRouteContext,
} from "@/lib/client-audit-snapshots"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  CHECK_CONSTRAINED_ESTATE_BENEFICIARY_FIELDS,
  CHECK_CONSTRAINED_ESTATE_EXECUTOR_FIELDS,
  CHECK_CONSTRAINED_POWER_OF_ATTORNEY_FIELDS,
  CHECK_CONSTRAINED_PROFESSIONAL_RELATIONSHIP_FIELDS,
  coerceEmptyToNull,
} from "@/lib/input-coercion"

type ClientResourceRowContext = {
  params: Promise<{
    id: string
    rowId: string
  }>
}

type FieldType = "string" | "boolean" | "date" | "integer"

type ResourceFieldConfig = {
  column: string
  aliases?: string[]
  type?: FieldType
  requiredOnCreate?: boolean
  allowedValues?: readonly string[]
}

type ClientProfileResourceConfig = {
  tableName: string
  entityType: string
  fields: ResourceFieldConfig[]
  coercionFields: readonly string[]
}

const PROFESSIONAL_RELATIONSHIP_TYPES = [
  "doctor",
  "solicitor",
  "accountant",
  "banker",
  "mortgage_broker",
  "other_adviser",
  "other_professional",
] as const

const ESTATE_BENEFICIARY_ENTITY_TYPES = [
  "person",
  "charity",
  "trust",
  "estate",
  "other",
] as const

const ESTATE_EXECUTOR_ENTITY_TYPES = [
  "person",
  "trustee_company",
  "other",
] as const

const POWER_OF_ATTORNEY_TYPES = [
  "enduring",
  "general",
  "medical",
  "financial",
  "other",
] as const

const COMMON_PERSON_FIELDS: ResourceFieldConfig[] = [
  { column: "first_name", aliases: ["firstName"] },
  { column: "surname" },
  { column: "preferred_name", aliases: ["preferredName"] },
  { column: "notes" },
]

export const PROFESSIONAL_RELATIONSHIP_CONFIG: ClientProfileResourceConfig = {
  tableName: "professional_relationship",
  entityType: "professional_relationship",
  coercionFields: CHECK_CONSTRAINED_PROFESSIONAL_RELATIONSHIP_FIELDS,
  fields: [
    {
      column: "relationship_type",
      aliases: ["relationshipType"],
      requiredOnCreate: true,
      allowedValues: PROFESSIONAL_RELATIONSHIP_TYPES,
    },
    { column: "is_authorised", aliases: ["isAuthorised"], type: "boolean" },
    { column: "authorisation_expiry", aliases: ["authorisationExpiry"], type: "date" },
    { column: "first_name", aliases: ["firstName"] },
    { column: "surname" },
    { column: "company" },
    { column: "phone" },
    { column: "email" },
    { column: "address_line", aliases: ["addressLine"] },
    { column: "address_suburb", aliases: ["addressSuburb"] },
    { column: "address_state", aliases: ["addressState"] },
    { column: "address_postcode", aliases: ["addressPostcode"] },
    { column: "notes" },
  ],
}

export const ESTATE_BENEFICIARY_CONFIG: ClientProfileResourceConfig = {
  tableName: "estate_beneficiary",
  entityType: "estate_beneficiary",
  coercionFields: CHECK_CONSTRAINED_ESTATE_BENEFICIARY_FIELDS,
  fields: [
    {
      column: "entity_type",
      aliases: ["entityType"],
      requiredOnCreate: true,
      allowedValues: ESTATE_BENEFICIARY_ENTITY_TYPES,
    },
    ...COMMON_PERSON_FIELDS,
    { column: "age_of_entitlement", aliases: ["ageOfEntitlement"], type: "integer" },
  ],
}

export const ESTATE_EXECUTOR_CONFIG: ClientProfileResourceConfig = {
  tableName: "estate_executor",
  entityType: "estate_executor",
  coercionFields: CHECK_CONSTRAINED_ESTATE_EXECUTOR_FIELDS,
  fields: [
    {
      column: "entity_type",
      aliases: ["entityType"],
      requiredOnCreate: true,
      allowedValues: ESTATE_EXECUTOR_ENTITY_TYPES,
    },
    ...COMMON_PERSON_FIELDS,
  ],
}

export const POWER_OF_ATTORNEY_CONFIG: ClientProfileResourceConfig = {
  tableName: "power_of_attorney",
  entityType: "power_of_attorney",
  coercionFields: CHECK_CONSTRAINED_POWER_OF_ATTORNEY_FIELDS,
  fields: [
    {
      column: "poa_type",
      aliases: ["poaType"],
      requiredOnCreate: true,
      allowedValues: POWER_OF_ATTORNEY_TYPES,
    },
    { column: "location" },
    {
      column: "entity_type",
      aliases: ["entityType"],
      requiredOnCreate: true,
      allowedValues: ESTATE_EXECUTOR_ENTITY_TYPES,
    },
    ...COMMON_PERSON_FIELDS,
  ],
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }

  return `"${identifier}"`
}

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

function fieldKeys(field: ResourceFieldConfig) {
  return [field.column, ...(field.aliases ?? [])]
}

function parseString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseBoolean(value: unknown): boolean | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null
  }

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
    if (["false", "0", "no", "off"].includes(normalized)) return false
  }

  return "invalid"
}

function parseDate(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? "invalid" : value
  }

  if (typeof value !== "string") {
    return "invalid"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? "invalid" : parsed
}

function parseInteger(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : "invalid"
}

function parseFieldValue(field: ResourceFieldConfig, value: unknown) {
  switch (field.type ?? "string") {
    case "boolean":
      return parseBoolean(value)
    case "date":
      return parseDate(value)
    case "integer":
      return parseInteger(value)
    case "string":
    default:
      return parseString(value)
  }
}

function buildData(
  config: ClientProfileResourceConfig,
  body: Record<string, unknown>,
  mode: "create" | "update",
) {
  const data: Record<string, unknown> = {}

  for (const field of config.fields) {
    const keys = fieldKeys(field)
    const isPresent = hasAnyProperty(body, keys)

    if (!isPresent) {
      if (mode === "create" && field.requiredOnCreate) {
        return { error: `${field.column} is required` }
      }

      continue
    }

    const parsed = parseFieldValue(field, valueFor(body, keys))

    if (parsed === "invalid") {
      return { error: `invalid ${field.column}` }
    }

    if (field.requiredOnCreate && parsed === null) {
      return { error: `${field.column} is required` }
    }

    if (
      field.allowedValues &&
      parsed !== null &&
      typeof parsed === "string" &&
      !field.allowedValues.includes(parsed)
    ) {
      return { error: `invalid ${field.column}` }
    }

    data[field.column] = parsed
  }

  return {
    data: coerceEmptyToNull(data, config.coercionFields),
  }
}

async function personExists(personId: string) {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { id: true },
  })

  return Boolean(person)
}

async function loadResourceRow(
  config: ClientProfileResourceConfig,
  rowId: string,
  personId?: string,
) {
  const tableName = quoteIdentifier(config.tableName)
  const clauses = [`id = $1`]
  const values = [rowId]

  if (personId) {
    clauses.push(`person_id = $2`)
    values.push(personId)
  }

  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT *
     FROM ${tableName}
     WHERE ${clauses.join(" AND ")}
     LIMIT 1`,
    ...values,
  )

  return rows[0] ?? null
}

async function listResourceRows(config: ClientProfileResourceConfig, personId: string) {
  return db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT *
     FROM ${quoteIdentifier(config.tableName)}
     WHERE person_id = $1
     ORDER BY created_at ASC, id ASC`,
    personId,
  )
}

async function insertResourceRow(
  config: ClientProfileResourceConfig,
  data: Record<string, unknown>,
) {
  const columns = Object.keys(data)
  const columnSql = columns.map(quoteIdentifier).join(", ")
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ")

  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `INSERT INTO ${quoteIdentifier(config.tableName)} (${columnSql})
     VALUES (${placeholders})
     RETURNING *`,
    ...columns.map((column) => data[column]),
  )

  return rows[0]
}

async function updateResourceRow(
  config: ClientProfileResourceConfig,
  rowId: string,
  personId: string,
  data: Record<string, unknown>,
) {
  const columns = Object.keys(data)
  const assignments = columns.map(
    (column, index) => `${quoteIdentifier(column)} = $${index + 1}`,
  )
  assignments.push(`"updated_at" = now()`)

  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `UPDATE ${quoteIdentifier(config.tableName)}
     SET ${assignments.join(", ")}
     WHERE id = $${columns.length + 1}
       AND person_id = $${columns.length + 2}
     RETURNING *`,
    ...columns.map((column) => data[column]),
    rowId,
    personId,
  )

  return rows[0] ?? null
}

async function deleteResourceRow(
  config: ClientProfileResourceConfig,
  rowId: string,
  personId: string,
) {
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `DELETE FROM ${quoteIdentifier(config.tableName)}
     WHERE id = $1
       AND person_id = $2
     RETURNING *`,
    rowId,
    personId,
  )

  return rows[0] ?? null
}

export function createClientProfileResourceCollectionRoutes(
  config: ClientProfileResourceConfig,
) {
  async function listRows(
    _request: Request,
    { params }: ClientRouteContext,
  ) {
    const { id } = await params

    try {
      if (!(await personExists(id))) {
        return NextResponse.json({ error: "person not found" }, { status: 404 })
      }

      return NextResponse.json({
        items: await listResourceRows(config, id),
      })
    } catch (error) {
      console.error(`[${config.entityType} list error]`, error)
      return NextResponse.json({ error: `failed to list ${config.entityType}` }, { status: 500 })
    }
  }

  async function createRow(
    request: Request,
    { params }: ClientRouteContext,
  ) {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const result = buildData(config, body, "create")

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    try {
      if (!(await personExists(id))) {
        return NextResponse.json({ error: "person not found" }, { status: 404 })
      }

      const row = await insertResourceRow(config, {
        person_id: id,
        ...result.data,
      })

      return NextResponse.json(row)
    } catch (error) {
      console.error(`[${config.entityType} create error]`, error)
      return NextResponse.json({ error: `failed to create ${config.entityType}` }, { status: 500 })
    }
  }

  return {
    GET: listRows,
    POST: withAuditTrail<ClientRouteContext>(createRow, {
      entity_type: config.entityType,
      action: "CREATE",
      beforeFn: async () => null,
      afterFn: async (_request, _context, auditContext) => {
        const id = await responseId(auditContext)
        return id ? loadResourceRow(config, id) : null
      },
      entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
      metadataFn: async (_request, context) => ({
        person_id: await context.params.then((params) => params.id),
      }),
    }),
  }
}

export function createClientProfileResourceRowRoutes(
  config: ClientProfileResourceConfig,
) {
  async function updateRow(
    request: Request,
    { params }: ClientResourceRowContext,
  ) {
    const { id, rowId } = await params
    const body = (await request.json()) as Record<string, unknown>
    const result = buildData(config, body, "update")

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    try {
      const existing = await loadResourceRow(config, rowId, id)
      if (!existing) {
        return NextResponse.json({ error: `${config.entityType} not found` }, { status: 404 })
      }

      const row = await updateResourceRow(config, rowId, id, result.data)
      return NextResponse.json(row)
    } catch (error) {
      console.error(`[${config.entityType} update error]`, error)
      return NextResponse.json({ error: `failed to update ${config.entityType}` }, { status: 500 })
    }
  }

  async function removeRow(
    _request: Request,
    { params }: ClientResourceRowContext,
  ) {
    const { id, rowId } = await params

    try {
      const deleted = await deleteResourceRow(config, rowId, id)
      if (!deleted) {
        return NextResponse.json({ error: `${config.entityType} not found` }, { status: 404 })
      }

      return NextResponse.json({ id: rowId, deleted: true })
    } catch (error) {
      console.error(`[${config.entityType} delete error]`, error)
      return NextResponse.json({ error: `failed to delete ${config.entityType}` }, { status: 500 })
    }
  }

  return {
    PATCH: withAuditTrail<ClientResourceRowContext>(updateRow, {
      entity_type: config.entityType,
      action: "UPDATE",
      beforeFn: async (_request, context) => {
        const { id, rowId } = await context.params
        return loadResourceRow(config, rowId, id)
      },
      afterFn: async (_request, context) => {
        const { id, rowId } = await context.params
        return loadResourceRow(config, rowId, id)
      },
      entityIdFn: async (_request, context) => {
        const { rowId } = await context.params
        return rowId
      },
    }),
    DELETE: withAuditTrail<ClientResourceRowContext>(removeRow, {
      entity_type: config.entityType,
      action: "DELETE",
      beforeFn: async (_request, context) => {
        const { id, rowId } = await context.params
        return loadResourceRow(config, rowId, id)
      },
      afterFn: async () => null,
      entityIdFn: async (_request, context) => {
        const { rowId } = await context.params
        return rowId
      },
    }),
  }
}
