import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

const INITIAL_MEETING_KEY = "INITIAL_MEETING"

type DbClient = Prisma.TransactionClient | typeof db

type ForeignKeyRow = {
  referring_table: string
  referring_column: string
  constraint_name: string
  delete_rule: string
  referenced_table: string
}

type Condition = {
  toSql: (index: number) => string
  value: unknown
}

type PartyDeleteContext = {
  partyId: string
  partyName: string
  engagementIds: string[]
  workflowInstanceIds: string[]
  taskIds: string[]
  householdIds: string[]
}

type DeleteCountMap = Record<string, number>

export class PartyDeleteBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PartyDeleteBlockedError"
  }
}

export class PartyNotFoundError extends Error {
  constructor(message = "client not found") {
    super(message)
    this.name = "PartyNotFoundError"
  }
}

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`invalid SQL identifier: ${value}`)
  }

  return `"${value.replace(/"/g, "\"\"")}"`
}

function formatComplianceDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

/**
 * Deletion gate semantics:
 * - opened_at is the scheduled meeting start from Calendly.
 * - completed_at is used for cancellation/closure and is not a reliable held-meeting signal.
 * - Therefore, "Initial Meeting held" is proxied as:
 *   meeting_type_key = INITIAL_MEETING AND opened_at < now() AND status != cancelled.
 *
 * TODO(task-43c.3b+): switch this gate to an explicit "meeting held" signal once
 * Journey outcomes support recording substantive Initial Meeting completion.
 */
export async function canDeleteParty(
  partyId: string,
): Promise<{ deletable: boolean; reason?: string }> {
  const heldInitialMeetingRows = await db.$queryRawUnsafe<{ opened_at: Date }[]>(
    `
      SELECT opened_at
      FROM engagement
      WHERE party_id = $1::uuid
        AND meeting_type_key = $2
        AND opened_at < NOW()
        AND COALESCE(LOWER(status), '') <> 'cancelled'
      ORDER BY opened_at DESC
      LIMIT 1
    `,
    partyId,
    INITIAL_MEETING_KEY,
  )

  const heldInitialMeeting = heldInitialMeetingRows[0]
  if (heldInitialMeeting) {
    return {
      deletable: false,
      reason: `Initial Meeting held on ${formatComplianceDate(heldInitialMeeting.opened_at)} \u2014 record retained for compliance.`,
    }
  }

  return { deletable: true }
}

async function listForeignKeysForDeleteTargets(client: DbClient): Promise<ForeignKeyRow[]> {
  return client.$queryRawUnsafe<ForeignKeyRow[]>(
    `
      SELECT
        tc.table_name AS referring_table,
        kcu.column_name AS referring_column,
        tc.constraint_name,
        rc.delete_rule,
        ccu.table_name AS referenced_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name IN ('party', 'engagement', 'workflow_instance', 'Task', 'household')
      ORDER BY tc.table_name, kcu.column_name
    `,
  )
}

async function loadPartyDeleteContext(client: DbClient, partyId: string): Promise<PartyDeleteContext> {
  const party = await client.party.findUnique({
    where: { id: partyId },
    select: {
      id: true,
      display_name: true,
    },
  })

  if (!party) {
    throw new PartyNotFoundError()
  }

  const engagements = await client.engagement.findMany({
    where: {
      party_id: partyId,
    },
    select: {
      id: true,
      household_id: true,
    },
  })

  const engagementIds = engagements.map((engagement) => engagement.id)

  const workflowInstanceWhereOr: Prisma.workflow_instanceWhereInput[] = [{ party_id: partyId }]
  if (engagementIds.length > 0) {
    workflowInstanceWhereOr.push({
      engagement_id: {
        in: engagementIds,
      },
    })
  }

  const workflowInstances = await client.workflow_instance.findMany({
    where: {
      OR: workflowInstanceWhereOr,
    },
    select: {
      id: true,
      household_id: true,
    },
  })

  const workflowInstanceIds = workflowInstances.map((instance) => instance.id)

  const directTasks = await client.task.findMany({
    where: {
      clientId: partyId,
    },
    select: {
      id: true,
    },
  })

  const spawnedTasks =
    workflowInstanceIds.length > 0
      ? await client.workflow_spawned_task.findMany({
          where: {
            workflow_instance_id: {
              in: workflowInstanceIds,
            },
          },
          select: {
            task_id: true,
          },
        })
      : []

  const taskIds = Array.from(
    new Set([
      ...directTasks.map((task) => task.id),
      ...spawnedTasks.map((spawned) => spawned.task_id),
    ]),
  )

  const householdMembers = await client.household_member.findMany({
    where: {
      party_id: partyId,
    },
    select: {
      household_id: true,
    },
  })

  const householdIds = Array.from(
    new Set([
      ...householdMembers.map((member) => member.household_id),
      ...engagements.map((engagement) => engagement.household_id).filter((value): value is string => Boolean(value)),
      ...workflowInstances
        .map((instance) => instance.household_id)
        .filter((value): value is string => Boolean(value)),
    ]),
  )

  return {
    partyId: party.id,
    partyName: party.display_name,
    engagementIds,
    workflowInstanceIds,
    taskIds,
    householdIds,
  }
}

function addCondition(
  map: Map<string, Condition[]>,
  tableName: string,
  condition: Condition | null,
) {
  if (!condition) {
    return
  }

  const existing = map.get(tableName) ?? []
  existing.push(condition)
  map.set(tableName, existing)
}

function buildConditionMap(
  context: PartyDeleteContext,
  foreignKeys: ForeignKeyRow[],
): Map<string, Condition[]> {
  const map = new Map<string, Condition[]>()

  for (const foreignKey of foreignKeys) {
    const tableName = foreignKey.referring_table
    const columnName = foreignKey.referring_column

    if (foreignKey.referenced_table === "party") {
      addCondition(map, tableName, {
        toSql: (index) => `${quoteIdentifier(columnName)} = $${index}::uuid`,
        value: context.partyId,
      })
      continue
    }

    if (foreignKey.referenced_table === "engagement" && context.engagementIds.length > 0) {
      addCondition(map, tableName, {
        toSql: (index) => `${quoteIdentifier(columnName)} = ANY($${index}::uuid[])`,
        value: context.engagementIds,
      })
      continue
    }

    if (foreignKey.referenced_table === "workflow_instance" && context.workflowInstanceIds.length > 0) {
      addCondition(map, tableName, {
        toSql: (index) => `${quoteIdentifier(columnName)} = ANY($${index}::uuid[])`,
        value: context.workflowInstanceIds,
      })
      continue
    }

    if (foreignKey.referenced_table === "Task" && context.taskIds.length > 0) {
      addCondition(map, tableName, {
        toSql: (index) => `${quoteIdentifier(columnName)} = ANY($${index}::text[])`,
        value: context.taskIds,
      })
      continue
    }

    if (foreignKey.referenced_table === "household" && context.householdIds.length > 0) {
      addCondition(map, tableName, {
        toSql: (index) => `${quoteIdentifier(columnName)} = ANY($${index}::uuid[])`,
        value: context.householdIds,
      })
    }
  }

  if (context.taskIds.length > 0) {
    addCondition(map, "Task", {
      toSql: (index) => `${quoteIdentifier("id")} = ANY($${index}::text[])`,
      value: context.taskIds,
    })
  }

  addCondition(map, "EmailLog", {
    toSql: (index) => `${quoteIdentifier("clientId")} = $${index}::uuid`,
    value: context.partyId,
  })

  return map
}

function toSummaryCounts(tableCounts: DeleteCountMap): DeleteCountMap {
  return {
    ...tableCounts,
    engagements: tableCounts.engagement ?? 0,
    workflow_instances: tableCounts.workflow_instance ?? 0,
    workflow_spawned_tasks: tableCounts.workflow_spawned_task ?? 0,
    tasks: tableCounts.Task ?? 0,
    documents: tableCounts.document ?? 0,
    notes: tableCounts.TaskNote ?? 0,
    timeline_events: tableCounts.file_note ?? 0,
    emails: tableCounts.EmailLog ?? 0,
  }
}

function buildScopedSql(conditions: Condition[]) {
  const params: unknown[] = []
  const clauses: string[] = []

  for (const condition of conditions) {
    params.push(condition.value)
    clauses.push(condition.toSql(params.length))
  }

  return {
    whereSql: clauses.length > 0 ? clauses.map((clause) => `(${clause})`).join(" OR ") : "",
    params,
  }
}

async function countScopedRows(
  client: DbClient,
  tableName: string,
  conditions: Condition[],
) {
  if (conditions.length === 0) {
    return 0
  }

  const { whereSql, params } = buildScopedSql(conditions)
  const rows = await client.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)} WHERE ${whereSql}`,
    ...params,
  )

  return rows[0]?.count ?? 0
}

async function deleteScopedRows(
  client: DbClient,
  tableName: string,
  conditions: Condition[],
) {
  if (conditions.length === 0) {
    return 0
  }

  const { whereSql, params } = buildScopedSql(conditions)
  return client.$executeRawUnsafe(
    `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${whereSql}`,
    ...params,
  )
}

async function collectCounts(
  client: DbClient,
  context: PartyDeleteContext,
  foreignKeys: ForeignKeyRow[],
) {
  const conditionMap = buildConditionMap(context, foreignKeys)
  const discoveredTables = Array.from(new Set(foreignKeys.map((foreignKey) => foreignKey.referring_table)))
  const allTables = Array.from(new Set([...discoveredTables, "Task", "EmailLog"]))

  const counts: DeleteCountMap = {}

  for (const tableName of allTables) {
    const conditions = conditionMap.get(tableName) ?? []
    counts[tableName] = await countScopedRows(client, tableName, conditions)
  }

  return {
    counts: toSummaryCounts(counts),
    conditionMap,
    discoveredTables: allTables,
  }
}

function resolveDeleteOrder(discoveredTables: string[]) {
  const preferredOrder = [
    "workflow_event",
    "workflow_spawned_task",
    "TaskDocumentLink",
    "TaskNote",
    "TaskOwner",
    "advice_scope_item",
    "client_instruction",
    "review_cycle",
    "document",
    "file_note",
    "goal",
    "Task",
    "workflow_instance",
    "engagement",
    "EmailLog",
    "address",
    "authority_grant",
    "beneficiary_nomination",
    "client_classification",
    "complaint",
    "compliance_register",
    "consent",
    "contact_method",
    "employment_profile",
    "estate",
    "expense_item",
    "fee_arrangement",
    "financial_account",
    "household_member",
    "income_item",
    "insurance_policy",
    "liability",
    "organisation",
    "ownership_interest",
    "portal_account",
    "relationship",
    "risk_profile",
    "tax_residency",
    "verification_check",
  ]

  const discovered = new Set(discoveredTables)
  const ordered = preferredOrder.filter((tableName) => discovered.has(tableName))
  const remaining = discoveredTables
    .filter((tableName) => !ordered.includes(tableName))
    .sort((left, right) => left.localeCompare(right))

  return [...ordered, ...remaining]
}

export async function getDeletePreview(partyId: string): Promise<{
  deletable: boolean
  reason?: string
  partyName: string
  counts: Record<string, number>
}> {
  const context = await loadPartyDeleteContext(db, partyId)
  const [deletableResult, foreignKeys] = await Promise.all([
    canDeleteParty(partyId),
    listForeignKeysForDeleteTargets(db),
  ])

  const { counts } = await collectCounts(db, context, foreignKeys)

  return {
    deletable: deletableResult.deletable,
    reason: deletableResult.reason,
    partyName: context.partyName,
    counts,
  }
}

export async function hardDeleteParty(partyId: string, userId: string): Promise<{
  success: true
  counts: Record<string, number>
}> {
  const gate = await canDeleteParty(partyId)
  if (!gate.deletable) {
    throw new PartyDeleteBlockedError(gate.reason ?? "client cannot be deleted")
  }

  const context = await loadPartyDeleteContext(db, partyId)
  const foreignKeys = await listForeignKeysForDeleteTargets(db)
  const { conditionMap, discoveredTables } = await collectCounts(db, context, foreignKeys)
  const deleteOrder = resolveDeleteOrder(discoveredTables)

  const deletedCounts: DeleteCountMap = {}

  await db.$transaction(async (tx) => {
    for (const tableName of deleteOrder) {
      if (tableName === "party") {
        continue
      }

      const conditions = conditionMap.get(tableName) ?? []
      deletedCounts[tableName] = await deleteScopedRows(tx, tableName, conditions)
    }

    const deletedParty = await tx.$executeRawUnsafe(
      `DELETE FROM "party" WHERE "id" = $1::uuid`,
      context.partyId,
    )

    if (deletedParty !== 1) {
      throw new PartyNotFoundError()
    }

    deletedCounts.party = deletedParty
  })

  const counts = toSummaryCounts(deletedCounts)
  console.info(`[partyDelete] partyId=${context.partyId} userId=${userId} counts=${JSON.stringify(counts)}`)

  return {
    success: true,
    counts,
  }
}
