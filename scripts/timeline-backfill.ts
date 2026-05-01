import { performance } from 'node:perf_hooks'
import path from 'node:path'

import { config } from 'dotenv'
import type { Prisma } from '@prisma/client'

config({ path: path.resolve(process.cwd(), '.env.local') })

let db: (typeof import('../src/lib/db'))['db']
let writeTimelineEntry: (typeof import('../src/lib/timeline'))['writeTimelineEntry']

const BATCH_SIZE = 1000
const NIL_UUID = '00000000-0000-0000-0000-000000000000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type BackfillSource =
  | 'file_note'
  | 'EmailLog'
  | 'Task'
  | 'alert_instance'
  | 'audit_event'
  | 'workflow_instance'

type BackfillStats = {
  source: BackfillSource
  scanned: number
  inserted: number
  skippedExisting: number
  skippedNoParty: number
  noPartySamples: string[]
}

type TimelineTarget = {
  party_id: string
  household_id: string | null
}

type TimelineCandidate = {
  party_id: string
  household_id?: string | null
  kind:
    | 'email_in'
    | 'email_out'
    | 'sms_in'
    | 'sms_out'
    | 'phone_call'
    | 'meeting'
    | 'file_note'
    | 'document'
    | 'portal_message'
    | 'workflow_event'
    | 'alert'
    | 'task'
    | 'system'
  title: string
  body?: string | null
  actor_user_id?: string | null
  related_entity_type: string
  related_entity_id: string
  occurred_at?: Date
  metadata?: Record<string, unknown> | null
}

const DOMAIN_TIMELINE_ENTITY_TYPES = new Set([
  'emaillog',
  'file_note',
  'sharepointfile',
  'sharepointfolder',
  'task',
  'alert_instance',
])

const partyExistsCache = new Map<string, boolean>()

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value) && value !== NIL_UUID
}

function normalizeEntityType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function readStringField(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!source) {
    return null
  }

  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function asIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function createStats(source: BackfillSource): BackfillStats {
  return {
    source,
    scanned: 0,
    inserted: 0,
    skippedExisting: 0,
    skippedNoParty: 0,
    noPartySamples: [],
  }
}

function skipNoParty(stats: BackfillStats, sample: string) {
  stats.skippedNoParty += 1
  if (stats.noPartySamples.length < 10) {
    stats.noPartySamples.push(sample)
  }
}

function parseArgs() {
  const args = new Set(process.argv.slice(2))
  const execute = args.has('--execute')

  if (execute && args.has('--dry-run')) {
    throw new Error('Choose either --dry-run or --execute, not both.')
  }

  return {
    execute,
    dryRun: !execute,
  }
}

async function partyExists(partyId: string) {
  const cached = partyExistsCache.get(partyId)
  if (cached !== undefined) {
    return cached
  }

  const party = await db.party.findUnique({
    where: {
      id: partyId,
    },
    select: {
      id: true,
    },
  })
  const exists = Boolean(party)
  partyExistsCache.set(partyId, exists)
  return exists
}

async function targetsFromPartyOrHousehold(
  partyId: string | null | undefined,
  householdId: string | null | undefined,
): Promise<TimelineTarget[]> {
  if (isUuid(partyId) && (await partyExists(partyId))) {
    return [
      {
        party_id: partyId,
        household_id: isUuid(householdId) ? householdId : null,
      },
    ]
  }

  if (!isUuid(householdId)) {
    return []
  }

  const members = await db.household_member.findMany({
    where: {
      household_id: householdId,
      end_date: null,
    },
    select: {
      party_id: true,
    },
  })

  return members.map((member) => ({
    party_id: member.party_id,
    household_id: householdId,
  }))
}

async function targetsForEntity(
  entityType: string,
  entityId: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): Promise<TimelineTarget[]> {
  const normalized = normalizeEntityType(entityType)

  const metadataPartyId = readStringField(metadata, [
    'party_id',
    'owner_party_id',
    'person_id',
    'client_id',
    'clientId',
  ])
  const metadataHouseholdId = readStringField(metadata, ['household_id'])
  if (metadataPartyId || metadataHouseholdId) {
    const targets = await targetsFromPartyOrHousehold(
      metadataPartyId,
      metadataHouseholdId,
    )
    if (targets.length > 0) {
      return targets
    }
  }

  if (!isUuid(entityId)) {
    return []
  }

  if (normalized === 'person' || normalized === 'party' || normalized === 'client') {
    return targetsFromPartyOrHousehold(entityId, null)
  }

  if (normalized === 'household_group') {
    return targetsFromPartyOrHousehold(null, entityId)
  }

  if (normalized === 'property_asset') {
    const rows = await db.$queryRawUnsafe<{ owner_party_id: string }[]>(
      `SELECT owner_party_id
       FROM ownership_interest
       WHERE target_id = $1
         AND target_type IN ('property', 'property_asset')
         AND end_date IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      entityId,
    )

    return targetsFromPartyOrHousehold(rows[0]?.owner_party_id ?? null, null)
  }

  const lookupColumns: Record<string, { table: string; columns: string[] }> = {
    centrelink_detail: { table: 'centrelink_detail', columns: ['person_id'] },
    client_classification: {
      table: 'client_classification',
      columns: ['party_id', 'household_id'],
    },
    document: { table: 'document', columns: ['owner_party_id', 'household_id'] },
    engagement: { table: 'engagement', columns: ['party_id', 'household_id'] },
    estate_beneficiary: { table: 'estate_beneficiary', columns: ['person_id'] },
    estate_executor: { table: 'estate_executor', columns: ['person_id'] },
    financial_account: { table: 'financial_account', columns: ['owner_party_id'] },
    household_member: { table: 'household_member', columns: ['party_id', 'household_id'] },
    income_item: { table: 'income_item', columns: ['owner_party_id'] },
    liability: { table: 'liability', columns: ['owner_party_id'] },
    power_of_attorney: { table: 'power_of_attorney', columns: ['person_id'] },
    professional_relationship: {
      table: 'professional_relationship',
      columns: ['person_id'],
    },
    risk_profile: { table: 'risk_profile', columns: ['party_id'] },
    super_pension_account: { table: 'super_pension_account', columns: ['person_id'] },
    verification_check: { table: 'verification_check', columns: ['party_id'] },
    workflow_instance: { table: 'workflow_instance', columns: ['party_id', 'household_id'] },
  }

  const lookup = lookupColumns[normalized]
  if (!lookup) {
    return []
  }

  const columnSql = lookup.columns.map((column) => `"${column}"`).join(', ')
  const rows = await db.$queryRawUnsafe<Record<string, string | null>[]>(
    `SELECT ${columnSql}
     FROM "${lookup.table}"
     WHERE id = $1
     LIMIT 1`,
    entityId,
  )
  const row = rows[0] ?? null

  return targetsFromPartyOrHousehold(
    readStringField(row, ['party_id', 'owner_party_id', 'person_id']),
    readStringField(row, ['household_id']),
  )
}

async function timelineExists(candidate: TimelineCandidate) {
  const existing = await db.timeline_entry.findFirst({
    where: {
      source: 'native',
      related_entity_type: candidate.related_entity_type,
      related_entity_id: candidate.related_entity_id,
      party_id: candidate.party_id,
    },
    select: {
      id: true,
    },
  })

  return Boolean(existing)
}

async function emitCandidate(
  stats: BackfillStats,
  candidate: TimelineCandidate,
  execute: boolean,
) {
  if (await timelineExists(candidate)) {
    stats.skippedExisting += 1
    return
  }

  stats.inserted += 1
  if (!execute) {
    return
  }

  await writeTimelineEntry({
    party_id: candidate.party_id,
    household_id: candidate.household_id ?? null,
    kind: candidate.kind,
    source: 'native',
    title: candidate.title,
    body: candidate.body ?? null,
    actor_user_id: candidate.actor_user_id ?? null,
    related_entity_type: candidate.related_entity_type,
    related_entity_id: candidate.related_entity_id,
    occurred_at: candidate.occurred_at,
    metadata: candidate.metadata ?? null,
  })
}

async function walkBatches<T extends { id: string }>(
  fetchBatch: (cursor: string | null) => Promise<T[]>,
  processRow: (row: T) => Promise<void>,
) {
  let cursor: string | null = null

  while (true) {
    const rows = await fetchBatch(cursor)
    if (rows.length === 0) {
      return
    }

    for (const row of rows) {
      await processRow(row)
    }

    cursor = rows[rows.length - 1].id
  }
}

async function backfillFileNotes(execute: boolean) {
  const stats = createStats('file_note')

  await walkBatches(
    (cursor) =>
      db.file_note.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          party_id: true,
          household_id: true,
          engagement_id: true,
          note_type: true,
          text: true,
          author_user_id: true,
          created_at: true,
        },
      }),
    async (note) => {
      stats.scanned += 1
      const targets = await targetsFromPartyOrHousehold(note.party_id, note.household_id)
      if (targets.length === 0) {
        skipNoParty(stats, `${note.id} party=${note.party_id ?? 'null'} household=${note.household_id ?? 'null'}`)
        return
      }

      const isWorkflowJourneyNote =
        Boolean(note.engagement_id) && (note.note_type ?? 'general') === 'general'
      const kind = isWorkflowJourneyNote ? 'workflow_event' : 'file_note'
      const title = isWorkflowJourneyNote
        ? note.text
        : `File note: ${note.note_type ?? 'general'}`

      for (const target of targets) {
        await emitCandidate(
          stats,
          {
            ...target,
            kind,
            title,
            body: note.text,
            actor_user_id: note.author_user_id,
            related_entity_type: 'file_note',
            related_entity_id: note.id,
            occurred_at: note.created_at,
            metadata: {
              engagement_id: note.engagement_id,
              note_type: note.note_type,
            },
          },
          execute,
        )
      }
    },
  )

  return stats
}

async function backfillEmailLogs(execute: boolean) {
  const stats = createStats('EmailLog')

  await walkBatches(
    (cursor) =>
      db.emailLog.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          clientId: true,
          templateId: true,
          subject: true,
          body: true,
          sentAt: true,
          sentBy: true,
          status: true,
          graphMessageId: true,
        },
      }),
    async (email) => {
      stats.scanned += 1
      const targets = await targetsFromPartyOrHousehold(email.clientId, null)
      if (targets.length === 0) {
        skipNoParty(stats, `${email.id} clientId=${email.clientId}`)
        return
      }

      const titlePrefix = email.status === 'failed' ? 'Email failed' : 'Email sent'
      for (const target of targets) {
        await emitCandidate(
          stats,
          {
            ...target,
            kind: 'email_out',
            title: `${titlePrefix}: ${email.subject}`,
            body: email.body,
            actor_user_id: null,
            related_entity_type: 'EmailLog',
            related_entity_id: email.id,
            occurred_at: email.sentAt,
            metadata: {
              status: email.status,
              template_id: email.templateId,
              graph_message_id: email.graphMessageId,
              sent_by: email.sentBy,
            },
          },
          execute,
        )
      }
    },
  )

  return stats
}

async function backfillTasks(execute: boolean) {
  const stats = createStats('Task')

  await walkBatches(
    (cursor) =>
      db.task.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          clientId: true,
          title: true,
          description: true,
          type: true,
          subtype: true,
          status: true,
          dueDateStart: true,
          dueDateEnd: true,
          completedAt: true,
          isRecurring: true,
          recurrenceCadence: true,
          parentTaskId: true,
          createdAt: true,
          owners: {
            select: {
              userId: true,
            },
          },
        },
      }),
    async (task) => {
      stats.scanned += 1
      const targets = await targetsFromPartyOrHousehold(task.clientId, null)
      if (targets.length === 0) {
        skipNoParty(stats, `${task.id} clientId=${task.clientId}`)
        return
      }

      for (const target of targets) {
        await emitCandidate(
          stats,
          {
            ...target,
            kind: 'task',
            title: `Task created: ${task.title}`,
            body: task.description,
            actor_user_id: null,
            related_entity_type: 'Task',
            related_entity_id: task.id,
            occurred_at: task.createdAt,
            metadata: {
              status: task.status,
              type: task.type,
              subtype: task.subtype,
              due_date_start: asIso(task.dueDateStart),
              due_date_end: asIso(task.dueDateEnd),
              completed_at: asIso(task.completedAt),
              owner_user_ids: task.owners.map((owner) => owner.userId),
              is_recurring: task.isRecurring,
              recurrence_cadence: task.recurrenceCadence,
              parent_task_id: task.parentTaskId,
            },
          },
          execute,
        )
      }
    },
  )

  return stats
}

async function backfillAlerts(execute: boolean) {
  const stats = createStats('alert_instance')

  await walkBatches(
    (cursor) =>
      db.alert_instance.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          occurred_at: true,
          alert_type: true,
          entity_type: true,
          entity_id: true,
          payload: true,
          audit_event_id: true,
          audit_event: {
            select: {
              actor_id: true,
            },
          },
        },
      }),
    async (alert) => {
      stats.scanned += 1
      const targets = await targetsForEntity(alert.entity_type, alert.entity_id)
      if (targets.length === 0) {
        skipNoParty(stats, `${alert.id} ${alert.entity_type}/${alert.entity_id}`)
        return
      }

      const payload = toRecord(alert.payload)
      const field = readStringField(payload, ['field']) ?? alert.entity_type
      for (const target of targets) {
        await emitCandidate(
          stats,
          {
            ...target,
            kind: 'alert',
            title: `Alert: ${alert.entity_type}.${field} changed`,
            body: null,
            actor_user_id: alert.audit_event?.actor_id ?? null,
            related_entity_type: 'alert_instance',
            related_entity_id: alert.id,
            occurred_at: alert.occurred_at,
            metadata: {
              audit_event_id: alert.audit_event_id,
              alert_type: alert.alert_type,
              entity_type: alert.entity_type,
              entity_id: alert.entity_id,
              payload: alert.payload as Prisma.JsonValue,
            },
          },
          execute,
        )
      }
    },
  )

  return stats
}

function auditTimelineKind(entityType: string, eventType: string) {
  const normalized = normalizeEntityType(entityType)
  if (
    normalized === 'workflow_instance' ||
    normalized === 'engagement' ||
    eventType === 'OUTCOME_SET' ||
    eventType === 'WORKFLOW_ADVANCED' ||
    eventType === 'WORKFLOW_STOPPED' ||
    eventType === 'DRIVER_ACTION_RECORDED' ||
    eventType === 'WORKFLOW_SPAWNED' ||
    eventType === 'NUDGE_FIRED'
  ) {
    return 'workflow_event' as const
  }

  return 'system' as const
}

function labelForEntityType(entityType: string) {
  const labels: Record<string, string> = {
    centrelink_detail: 'Centrelink detail',
    client_classification: 'Client classification',
    engagement: 'Engagement',
    estate_beneficiary: 'Estate beneficiary',
    estate_executor: 'Estate executor',
    financial_account: 'Financial account',
    household_group: 'Household',
    household_member: 'Household member',
    income_item: 'Income item',
    liability: 'Liability',
    person: 'Client',
    power_of_attorney: 'Power of attorney',
    professional_relationship: 'Professional relationship',
    property_asset: 'Property asset',
    risk_profile: 'Risk profile',
    super_pension_account: 'Super/pension account',
    verification_check: 'Verification check',
    workflow_instance: 'Workflow',
  }

  const normalized = normalizeEntityType(entityType)
  return labels[normalized] ?? entityType.replace(/_/g, ' ')
}

function auditTimelineTitle(entityType: string, eventType: string) {
  const actionLabels: Record<string, string> = {
    CREATE: 'created',
    UPDATE: 'updated',
    DELETE: 'deleted',
    ARCHIVE: 'archived',
    OUTCOME_SET: 'outcome set',
    WORKFLOW_ADVANCED: 'advanced',
    WORKFLOW_STOPPED: 'stopped',
    DRIVER_ACTION_RECORDED: 'driver action recorded',
    WORKFLOW_SPAWNED: 'started',
    NUDGE_FIRED: 'nudge fired',
    SEND_COMMS: 'communication sent',
  }

  return `${labelForEntityType(entityType)} ${actionLabels[eventType] ?? eventType.toLowerCase()}`
}

async function backfillAuditEvents(execute: boolean) {
  const stats = createStats('audit_event')

  await walkBatches(
    (cursor) =>
      db.audit_event.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          event_type: true,
          actor_id: true,
          subject_type: true,
          subject_id: true,
          details: true,
          occurred_at: true,
          request_id: true,
        },
      }),
    async (event) => {
      stats.scanned += 1
      if (DOMAIN_TIMELINE_ENTITY_TYPES.has(normalizeEntityType(event.subject_type))) {
        stats.skippedExisting += 1
        return
      }

      const details = toRecord(event.details)
      const metadata = toRecord(details?.metadata) ?? details
      const targets = await targetsForEntity(
        event.subject_type,
        event.subject_id,
        metadata,
      )
      if (targets.length === 0) {
        skipNoParty(stats, `${event.id} ${event.event_type} ${event.subject_type}/${event.subject_id}`)
        return
      }

      for (const target of targets) {
        await emitCandidate(
          stats,
          {
            ...target,
            kind: auditTimelineKind(event.subject_type, event.event_type),
            title: auditTimelineTitle(event.subject_type, event.event_type),
            body: null,
            actor_user_id: event.actor_id,
            related_entity_type: 'audit_event',
            related_entity_id: event.id,
            occurred_at: event.occurred_at,
            metadata: {
              audit_event_id: event.id,
              audited_entity_type: event.subject_type,
              audited_entity_id: event.subject_id,
              action: event.event_type,
              request_id: event.request_id,
              details: event.details as Prisma.JsonValue,
            },
          },
          execute,
        )
      }
    },
  )

  return stats
}

async function backfillWorkflowInstances(execute: boolean) {
  const stats = createStats('workflow_instance')

  await walkBatches(
    (cursor) =>
      db.workflow_instance.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          engagement_id: true,
          party_id: true,
          household_id: true,
          status: true,
          current_stage: true,
          current_outcome_key: true,
          current_outcome_set_at: true,
          last_driver_action_key: true,
          last_driver_action_at: true,
          started_at: true,
          completed_at: true,
          workflow_template: {
            select: {
              id: true,
              key: true,
              name: true,
              version: true,
              description: true,
            },
          },
        },
      }),
    async (instance) => {
      stats.scanned += 1
      const targets = await targetsFromPartyOrHousehold(
        instance.party_id,
        instance.household_id,
      )
      if (targets.length === 0) {
        skipNoParty(stats, `${instance.id} party=${instance.party_id ?? 'null'} household=${instance.household_id ?? 'null'}`)
        return
      }

      const events: Array<{
        related_entity_type: string
        title: string
        body: string | null
        occurred_at: Date | null
        metadata: Record<string, unknown>
      }> = [
        {
          related_entity_type: 'workflow_instance',
          title: `Workflow started: ${instance.workflow_template.name}`,
          body: instance.workflow_template.description,
          occurred_at: instance.started_at,
          metadata: {
            engagement_id: instance.engagement_id,
            workflow_template_id: instance.workflow_template.id,
            workflow_template_key: instance.workflow_template.key,
            template_version: instance.workflow_template.version,
          },
        },
      ]

      if (instance.current_outcome_key && instance.current_outcome_set_at) {
        events.push({
          related_entity_type: 'workflow_instance.outcome',
          title: `Outcome set: ${instance.current_outcome_key}`,
          body: null,
          occurred_at: instance.current_outcome_set_at,
          metadata: {
            engagement_id: instance.engagement_id,
            outcome_key: instance.current_outcome_key,
            status: instance.status,
            current_stage: instance.current_stage,
          },
        })
      }

      if (instance.last_driver_action_key && instance.last_driver_action_at) {
        events.push({
          related_entity_type: 'workflow_instance.driver_action',
          title: `Driver action recorded: ${instance.last_driver_action_key}`,
          body: null,
          occurred_at: instance.last_driver_action_at,
          metadata: {
            engagement_id: instance.engagement_id,
            driver_action_key: instance.last_driver_action_key,
          },
        })
      }

      if (instance.completed_at) {
        events.push({
          related_entity_type: 'workflow_instance.completed',
          title:
            instance.status === 'cancelled'
              ? `Workflow stopped: ${instance.workflow_template.name}`
              : `Workflow completed: ${instance.workflow_template.name}`,
          body: null,
          occurred_at: instance.completed_at,
          metadata: {
            engagement_id: instance.engagement_id,
            status: instance.status,
            current_outcome_key: instance.current_outcome_key,
          },
        })
      }

      for (const event of events) {
        if (!event.occurred_at) {
          continue
        }

        for (const target of targets) {
          await emitCandidate(
            stats,
            {
              ...target,
              kind: 'workflow_event',
              title: event.title,
              body: event.body,
              actor_user_id: null,
              related_entity_type: event.related_entity_type,
              related_entity_id: instance.id,
              occurred_at: event.occurred_at,
              metadata: {
                ...event.metadata,
                workflow_instance_id: instance.id,
              },
            },
            execute,
          )
        }
      }
    },
  )

  return stats
}

function printSourceStats(stats: BackfillStats, execute: boolean) {
  const insertLabel = execute ? 'inserted' : 'would_insert'
  console.log(
    [
      stats.source.padEnd(18),
      `scanned=${stats.scanned}`,
      `${insertLabel}=${stats.inserted}`,
      `skip_existing=${stats.skippedExisting}`,
      `skip_no_party=${stats.skippedNoParty}`,
    ].join('  '),
  )
}

function printSummary(stats: BackfillStats[], execute: boolean, elapsedMs: number) {
  const insertLabel = execute ? 'inserted' : 'would_insert'
  const totals = stats.reduce(
    (acc, row) => ({
      scanned: acc.scanned + row.scanned,
      inserted: acc.inserted + row.inserted,
      skippedExisting: acc.skippedExisting + row.skippedExisting,
      skippedNoParty: acc.skippedNoParty + row.skippedNoParty,
    }),
    { scanned: 0, inserted: 0, skippedExisting: 0, skippedNoParty: 0 },
  )

  console.log('')
  console.log('Final summary')
  console.log('-------------')
  for (const row of stats) {
    printSourceStats(row, execute)
    if (row.noPartySamples.length > 0) {
      console.log(`  no_party_samples=${row.noPartySamples.join(' | ')}`)
    }
  }
  console.log(
    [
      'TOTAL'.padEnd(18),
      `scanned=${totals.scanned}`,
      `${insertLabel}=${totals.inserted}`,
      `skip_existing=${totals.skippedExisting}`,
      `skip_no_party=${totals.skippedNoParty}`,
    ].join('  '),
  )
  console.log(`elapsed_ms=${Math.round(elapsedMs)}`)
}

async function main() {
  ;({ db } = await import('../src/lib/db'))
  ;({ writeTimelineEntry } = await import('../src/lib/timeline'))

  const { execute, dryRun } = parseArgs()
  const started = performance.now()

  console.log(
    `[timeline-backfill] mode=${dryRun ? 'dry-run' : 'execute'} batch_size=${BATCH_SIZE}`,
  )

  const stats: BackfillStats[] = []
  for (const run of [
    backfillFileNotes,
    backfillEmailLogs,
    backfillTasks,
    backfillAlerts,
    backfillAuditEvents,
    backfillWorkflowInstances,
  ]) {
    const row = await run(execute)
    stats.push(row)
    printSourceStats(row, execute)
  }

  printSummary(stats, execute, performance.now() - started)
}

main()
  .catch((error) => {
    console.error('[timeline-backfill] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db?.$disconnect()
  })
