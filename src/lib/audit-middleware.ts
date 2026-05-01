import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { AuditAction, AuditEventInput, AuditSnapshot } from '@/lib/audit'
import {
  describeFieldChange,
  humanAction,
  humanEntityName,
  humanFieldName,
} from '@/lib/timeline-display'
import type { TimelineEntryInput, TimelineKind } from '@/lib/timeline'

type MaybePromise<T> = T | Promise<T>
type AuditEventWriteResult = string | { id?: string | null } | null | void

export type AlertInstanceWriteInput = {
  alert_type: 'FIELD_CHANGE'
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  audit_event_id: string
}

export type AuditedRouteHandler<TContext = unknown> = (
  request: Request,
  context: TContext,
) => MaybePromise<Response>

export interface AuditLifecycleContext {
  response?: Response
  beforeSnapshot?: AuditSnapshot | null
  afterSnapshot?: AuditSnapshot | null
  entityId?: string | null
}

export type AuditSnapshotFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<AuditSnapshot | undefined>

export type AuditEntityIdFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<string | null | undefined>

export type AuditEntityTypeFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<string | null | undefined>

export type AuditActionFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<AuditAction | null | undefined>

export type AuditMetadataFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<Record<string, unknown> | null | undefined>

export type AuditShouldAuditFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<boolean>

export interface AuditMiddlewareConfig<TContext = unknown> {
  entity_type: string | AuditEntityTypeFn<TContext>
  action: AuditAction | AuditActionFn<TContext>
  beforeFn?: AuditSnapshotFn<TContext>
  afterFn?: AuditSnapshotFn<TContext>
  entityIdFn?: AuditEntityIdFn<TContext>
  metadataFn?: AuditMetadataFn<TContext>
  shouldAuditFn?: AuditShouldAuditFn<TContext>
  actor?: 'session' | 'system'
}

interface SessionLike {
  user?: {
    id?: unknown
    email?: unknown
  }
}

interface AuditMiddlewareTestHooks {
  auth?: () => MaybePromise<SessionLike | null>
  writeAuditEvent?: (input: AuditEventInput) => Promise<AuditEventWriteResult>
  writeAlertInstance?: (input: AlertInstanceWriteInput) => Promise<void>
  requestId?: () => string
  logError?: (...args: unknown[]) => void
  resolveActorUserId?: (session: SessionLike | null) => MaybePromise<string | null>
  writeTimelineEntry?: (input: TimelineEntryInput) => Promise<void>
}

let testHooks: AuditMiddlewareTestHooks = {}
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DOMAIN_TIMELINE_ENTITY_TYPES = new Set([
  'emaillog',
  'file_note',
  'sharepointfile',
  'sharepointfolder',
  'task',
  'alert_instance',
  'timeline_entry',
])

type TimelineTarget = {
  party_id: string
  household_id: string | null
}

export function setAuditMiddlewareTestHooks(hooks: AuditMiddlewareTestHooks): void {
  testHooks = hooks
}

export function resetAuditMiddlewareTestHooks(): void {
  testHooks = {}
}

async function defaultAuth(): Promise<SessionLike | null> {
  const { auth } = await import('@/auth')
  return auth()
}

async function defaultWriteAuditEvent(
  input: AuditEventInput,
): Promise<AuditEventWriteResult> {
  const { writeAuditEvent } = await import('@/lib/audit')
  return writeAuditEvent(input)
}

function toJsonCompatible(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
    ),
  ) as Prisma.InputJsonValue
}

async function defaultWriteAlertInstance(
  input: AlertInstanceWriteInput,
): Promise<void> {
  const { db } = await import('@/lib/db')
  const alert = await db.alert_instance.create({
    select: {
      id: true,
      occurred_at: true,
      audit_event: {
        select: {
          actor_id: true,
        },
      },
    },
    data: {
      alert_type: input.alert_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      payload: toJsonCompatible(input.payload),
      audit_event_id: input.audit_event_id,
    },
  })

  await writeAlertTimelineEntry({
    alertId: alert.id,
    occurredAt: alert.occurred_at,
    actorUserId: alert.audit_event?.actor_id ?? null,
    input,
  })
}

function maybeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isUuid(value: string | null): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function auditEventIdFromResult(result: AuditEventWriteResult): string | null {
  if (typeof result === 'string') {
    return result
  }

  if (isRecord(result)) {
    return maybeString(result.id)
  }

  return null
}

function readClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  return (
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('true-client-ip')
  )
}

async function resolveActorUserIdFromSession(
  session: SessionLike | null,
): Promise<string | null> {
  if (testHooks.resolveActorUserId) {
    return testHooks.resolveActorUserId(session)
  }

  const sessionUserId = maybeString(session?.user?.id)
  if (isUuid(sessionUserId)) {
    return sessionUserId
  }

  const email = maybeString(session?.user?.email)
  if (!email) {
    return null
  }

  try {
    const { db } = await import('@/lib/db')
    const user = await db.user_account.findFirst({
      where: {
        OR: [
          { email },
          ...(sessionUserId ? [{ auth_subject: sessionUserId }] : []),
        ],
      },
      select: { id: true },
    })

    return user?.id ?? null
  } catch (error) {
    logAuditMiddlewareError('[Audit Middleware] Failed to resolve actor user id', error)
    return sessionUserId
  }
}

async function readActorContext(
  request: Request,
  actorMode: AuditMiddlewareConfig['actor'] = 'session',
): Promise<{
  actorUserId: string | null
  actorIp: string | null
  actorUserAgent: string | null
  requestId: string
}> {
  const requestId =
    request.headers.get('x-request-id') ?? (testHooks.requestId ?? randomUUID)()

  if (actorMode === 'system') {
    return {
      actorUserId: null,
      actorIp: null,
      actorUserAgent: null,
      requestId,
    }
  }

  const session = await (testHooks.auth ?? defaultAuth)()

  return {
    actorUserId: await resolveActorUserIdFromSession(session),
    actorIp: readClientIp(request.headers),
    actorUserAgent: request.headers.get('user-agent'),
    requestId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractIdFromSnapshot(snapshot: AuditSnapshot | null): string | null {
  if (!isRecord(snapshot)) {
    return null
  }

  return (
    maybeString(snapshot.id) ??
    maybeString(snapshot.entity_id) ??
    maybeString(snapshot.subject_id)
  )
}

async function extractIdFromContext(context: unknown): Promise<string | null> {
  if (!isRecord(context) || !('params' in context)) {
    return null
  }

  const params = await (context.params as MaybePromise<Record<string, unknown>>)
  if (!isRecord(params)) {
    return null
  }

  return (
    maybeString(params.id) ??
    maybeString(params.clientId) ??
    maybeString(params.partyId) ??
    maybeString(params.engagementId) ??
    maybeString(params.taskId)
  )
}

async function resolveEntityId<TContext>(
  request: Request,
  context: TContext,
  config: AuditMiddlewareConfig<TContext>,
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  if (config.entityIdFn) {
    const explicitId = await config.entityIdFn(request, context, auditContext)
    if (explicitId) {
      return explicitId
    }
  }

  return (
    extractIdFromSnapshot(auditContext.afterSnapshot ?? null) ??
    extractIdFromSnapshot(auditContext.beforeSnapshot ?? null) ??
    (await extractIdFromContext(context))
  )
}

async function resolveEntityType<TContext>(
  request: Request,
  context: TContext,
  config: AuditMiddlewareConfig<TContext>,
  auditContext: AuditLifecycleContext,
): Promise<string> {
  if (typeof config.entity_type === 'string') {
    return config.entity_type
  }

  return (await config.entity_type(request, context, auditContext)) ?? 'unknown'
}

async function resolveAction<TContext>(
  request: Request,
  context: TContext,
  config: AuditMiddlewareConfig<TContext>,
  auditContext: AuditLifecycleContext,
): Promise<AuditAction> {
  if (typeof config.action === 'string') {
    return config.action
  }

  return (await config.action(request, context, auditContext)) ?? 'UPDATE'
}

async function readSnapshot<TContext>(
  label: 'before' | 'after',
  snapshotFn: AuditSnapshotFn<TContext> | undefined,
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
): Promise<AuditSnapshot | null> {
  if (!snapshotFn) {
    return null
  }

  try {
    return (await snapshotFn(request, context, auditContext)) ?? null
  } catch (error) {
    logAuditMiddlewareError(
      `[Audit Middleware] Failed to capture ${label} snapshot`,
      error,
    )
    return null
  }
}

function logAuditMiddlewareError(message: string, error: unknown): void {
  ;(testHooks.logError ?? console.error)(message, error)
}

function logTimelineSkip(message: string, context: Record<string, unknown>): void {
  console.info(message, context)
}

function normalizeEntityType(entityType: string): string {
  return entityType.trim().toLowerCase()
}

function shouldUseAuditFallbackTimeline(entityType: string): boolean {
  return !DOMAIN_TIMELINE_ENTITY_TYPES.has(normalizeEntityType(entityType))
}

async function writeTimeline(input: TimelineEntryInput): Promise<void> {
  if (testHooks.writeTimelineEntry) {
    await testHooks.writeTimelineEntry(input)
    return
  }

  const { writeTimelineEntry } = await import('@/lib/timeline')
  await writeTimelineEntry(input)
}

function readStringField(
  source: Record<string, unknown> | null,
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

function snapshotRecords(snapshot: AuditSnapshot | null): Record<string, unknown>[] {
  if (!isRecord(snapshot)) {
    return []
  }

  const records = [snapshot]
  const nestedPerson = snapshot.person
  if (isRecord(nestedPerson)) {
    records.push(nestedPerson)
  }

  const ownershipInterest = snapshot.ownership_interest
  if (Array.isArray(ownershipInterest)) {
    for (const row of ownershipInterest) {
      if (isRecord(row)) {
        records.push(row)
      }
    }
  }

  return records
}

function readTimelineHintFromSnapshots(params: {
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
  metadata: Record<string, unknown> | null
}): { partyId: string | null; householdId: string | null } {
  const sources = [
    params.metadata,
    ...snapshotRecords(params.afterSnapshot),
    ...snapshotRecords(params.beforeSnapshot),
  ]

  for (const source of sources) {
    const partyId = readStringField(source, [
      'party_id',
      'owner_party_id',
      'person_id',
      'clientId',
      'client_id',
    ])
    const householdId = readStringField(source, ['household_id'])

    if (partyId || householdId) {
      return { partyId, householdId }
    }
  }

  return { partyId: null, householdId: null }
}

async function fanOutHouseholdTimelineTargets(
  householdId: string,
): Promise<TimelineTarget[]> {
  const { db } = await import('@/lib/db')
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

async function lookupTimelineHint(
  entityType: string,
  entityId: string | null,
): Promise<{ partyId: string | null; householdId: string | null }> {
  if (!entityId || !isUuid(entityId)) {
    return { partyId: null, householdId: null }
  }

  const normalized = normalizeEntityType(entityType)
  if (normalized === 'person' || normalized === 'party' || normalized === 'client') {
    return { partyId: entityId, householdId: null }
  }

  if (normalized === 'household_group') {
    return { partyId: null, householdId: entityId }
  }

  if (normalized === 'property_asset') {
    const { db } = await import('@/lib/db')
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

    return { partyId: rows[0]?.owner_party_id ?? null, householdId: null }
  }

  const lookupColumns: Record<string, { table: string; columns: string[] }> = {
    centrelink_detail: { table: 'centrelink_detail', columns: ['person_id'] },
    client_classification: {
      table: 'client_classification',
      columns: ['party_id', 'household_id'],
    },
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
    return { partyId: null, householdId: null }
  }

  const { db } = await import('@/lib/db')
  const columnSql = lookup.columns.map((column) => `"${column}"`).join(', ')
  const rows = await db.$queryRawUnsafe<Record<string, string | null>[]>(
    `SELECT ${columnSql}
     FROM "${lookup.table}"
     WHERE id = $1
     LIMIT 1`,
    entityId,
  )
  const row = rows[0] ?? null

  return {
    partyId:
      readStringField(row, ['party_id', 'owner_party_id', 'person_id']) ?? null,
    householdId: readStringField(row, ['household_id']) ?? null,
  }
}

async function resolveTimelineTargets(params: {
  entityType: string
  entityId: string | null
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
  metadata: Record<string, unknown> | null
}): Promise<TimelineTarget[]> {
  let { partyId, householdId } = readTimelineHintFromSnapshots(params)

  if (!partyId && !householdId) {
    const lookup = await lookupTimelineHint(params.entityType, params.entityId)
    partyId = lookup.partyId
    householdId = lookup.householdId
  }

  if (partyId) {
    return [{ party_id: partyId, household_id: householdId }]
  }

  if (householdId) {
    const targets = await fanOutHouseholdTimelineTargets(householdId)
    if (targets.length === 0) {
      logTimelineSkip('[Timeline] Skipped household timeline write with no active members', {
        household_id: householdId,
        entity_type: params.entityType,
        entity_id: params.entityId,
      })
    }
    return targets
  }

  logTimelineSkip('[Timeline] Skipped audit timeline write with no party context', {
    entity_type: params.entityType,
    entity_id: params.entityId,
  })
  return []
}

function auditTimelineKind(entityType: string, action: AuditAction): TimelineKind {
  const normalized = normalizeEntityType(entityType)
  if (
    normalized === 'workflow_instance' ||
    normalized === 'engagement' ||
    action === 'OUTCOME_SET' ||
    action === 'WORKFLOW_ADVANCED' ||
    action === 'WORKFLOW_STOPPED' ||
    action === 'DRIVER_ACTION_RECORDED' ||
    action === 'WORKFLOW_SPAWNED' ||
    action === 'NUDGE_FIRED'
  ) {
    return 'workflow_event'
  }

  return 'system'
}

function readSnapshotRecord(snapshot: AuditSnapshot | null): Record<string, unknown> | null {
  return isRecord(snapshot) ? snapshot : null
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatMelbourneDate(value: Date | null): string | null {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(value)
}

function formatMelbourneDateTime(value: Date | null): string | null {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Melbourne',
    timeZoneName: 'short',
  }).format(value)
}

function calendlyNoteValue(notes: string | null, label: string): string | null {
  if (!notes) {
    return null
  }

  const prefix = `${label}:`
  const line = notes
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(prefix))

  return line ? line.trim().slice(prefix.length).trim() || null : null
}

function meetingTypeLabel(snapshot: Record<string, unknown> | null): string {
  const notes = maybeString(snapshot?.notes)
  const fromNotes = calendlyNoteValue(notes, 'Meeting type')
  if (fromNotes) {
    return fromNotes.replace(/\s*\([^)]*\)\s*$/, '').trim() || fromNotes
  }

  return humanEntityName(maybeString(snapshot?.meeting_type_key) ?? 'meeting')
}

function inviteeFirstName(snapshot: Record<string, unknown> | null): string {
  const notes = maybeString(snapshot?.notes)
  const invitee = calendlyNoteValue(notes, 'Invitee')
    ?.replace(/<[^>]+>/g, '')
    .trim()
  const source = invitee || maybeString(snapshot?.invitee_email) || 'client'
  return source.split(/\s+/).find(Boolean) ?? 'client'
}

function calendlyTimelineText(params: {
  action: AuditAction
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
  metadata: Record<string, unknown> | null
}): { title: string; body: string | null } | null {
  const snapshot = readSnapshotRecord(params.afterSnapshot) ?? readSnapshotRecord(params.beforeSnapshot)
  const source = maybeString(snapshot?.source)?.toUpperCase()
  const metadataSource = maybeString(params.metadata?.source)?.toLowerCase()
  if (source !== 'CALENDLY' && metadataSource !== 'calendly') {
    return null
  }

  const notes = maybeString(snapshot?.notes)
  const meetingType = meetingTypeLabel(snapshot)
  const firstName = inviteeFirstName(snapshot)
  const startAt = parseDateValue(snapshot?.opened_at)
  const dateLabel = formatMelbourneDate(startAt) ?? 'the booked date'
  const eventType = maybeString(params.metadata?.event_type)
  const rescheduled =
    maybeString(snapshot?.calendly_rescheduled_from) ||
    notes?.toLowerCase().includes('rescheduled')
  const cancelled =
    eventType === 'invitee.canceled' ||
    maybeString(snapshot?.status) === 'cancelled' ||
    notes?.toLowerCase().includes('cancelled')

  const title =
    params.action === 'CREATE'
      ? `Calendly: ${meetingType} booked with ${firstName} for ${dateLabel}`
      : rescheduled
        ? 'Calendly: meeting rescheduled'
        : cancelled
          ? 'Calendly: meeting cancelled'
          : `Calendly: ${humanEntityName('engagement')} ${humanAction(params.action)}`

  const bodyLines = [
    `Meeting type: ${meetingType}`,
    `Start time: ${formatMelbourneDateTime(startAt) ?? 'Unknown'}`,
    `Duration: ${calendlyNoteValue(notes, 'Duration') ?? 'Unknown'}`,
    `Location: ${calendlyNoteValue(notes, 'Location') ?? 'Unknown'}`,
  ]

  return {
    title,
    body: bodyLines.join('\n'),
  }
}

function textForAuditTimeline(params: {
  entityType: string
  action: AuditAction
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
  metadata: Record<string, unknown> | null
}): { title: string; body: string | null } {
  if (normalizeEntityType(params.entityType) === 'engagement') {
    const calendlyText = calendlyTimelineText(params)
    if (calendlyText) {
      return calendlyText
    }
  }

  return {
    title: `${humanEntityName(params.entityType)} ${humanAction(params.action)}`,
    body: null,
  }
}

async function writeAuditTimelineFallback(params: {
  auditEventId: string | null
  action: AuditAction
  entityType: string
  entityId: string | null
  actorUserId: string | null
  requestId: string
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
  metadata: Record<string, unknown> | null
}): Promise<void> {
  try {
    if (!params.auditEventId || !shouldUseAuditFallbackTimeline(params.entityType)) {
      return
    }

    if (testHooks.writeAuditEvent && !testHooks.writeTimelineEntry) {
      return
    }

    const targets = await resolveTimelineTargets({
      entityType: params.entityType,
      entityId: params.entityId,
      beforeSnapshot: params.beforeSnapshot,
      afterSnapshot: params.afterSnapshot,
      metadata: params.metadata,
    })

    const timelineText = textForAuditTimeline({
      entityType: params.entityType,
      action: params.action,
      beforeSnapshot: params.beforeSnapshot,
      afterSnapshot: params.afterSnapshot,
      metadata: params.metadata,
    })

    for (const target of targets) {
      await writeTimeline({
        party_id: target.party_id,
        household_id: target.household_id,
        kind: auditTimelineKind(params.entityType, params.action),
        title: timelineText.title,
        body: timelineText.body,
        actor_user_id: params.actorUserId,
        related_entity_type: 'audit_event',
        related_entity_id: params.auditEventId,
        metadata: {
          audit_event_id: params.auditEventId,
          audited_entity_type: params.entityType,
          audited_entity_id: params.entityId,
          action: params.action,
          request_id: params.requestId,
          metadata: params.metadata,
        },
      })
    }
  } catch (error) {
    logAuditMiddlewareError(
      '[Audit Middleware] Failed to write timeline_entry; route response will still be returned',
      error,
    )
  }
}

async function writeAlertTimelineEntry(params: {
  alertId: string
  occurredAt: Date
  actorUserId: string | null
  input: AlertInstanceWriteInput
}): Promise<void> {
  try {
    const targets = await resolveTimelineTargets({
      entityType: params.input.entity_type,
      entityId: params.input.entity_id,
      beforeSnapshot: null,
      afterSnapshot: null,
      metadata: null,
    })
    const field =
      typeof params.input.payload.field === 'string'
        ? params.input.payload.field
        : params.input.entity_type
    const qualifiedField = `${params.input.entity_type}.${field}`
    const fieldChange = describeFieldChange(
      params.input.payload.old,
      params.input.payload.new,
    )

    for (const target of targets) {
      await writeTimeline({
        party_id: target.party_id,
        household_id: target.household_id,
        kind: 'alert',
        title: `${humanFieldName(qualifiedField)} ${fieldChange.verb}`,
        body: fieldChange.summary,
        actor_user_id: params.actorUserId,
        related_entity_type: 'alert_instance',
        related_entity_id: params.alertId,
        occurred_at: params.occurredAt,
        metadata: {
          audit_event_id: params.input.audit_event_id,
          alert_type: params.input.alert_type,
          entity_type: params.input.entity_type,
          entity_id: params.input.entity_id,
          payload: params.input.payload,
        },
      })
    }
  } catch (error) {
    logAuditMiddlewareError(
      '[Audit Middleware] Failed to write alert timeline_entry; route response will still be returned',
      error,
    )
  }
}

async function writeFieldChangeAlerts(params: {
  action: AuditAction
  entityType: string
  entityId: string | null
  auditEventId: string | null
  beforeSnapshot: AuditSnapshot | null
  afterSnapshot: AuditSnapshot | null
}): Promise<void> {
  if (
    params.action !== 'UPDATE' ||
    !params.auditEventId ||
    !isUuid(params.entityId) ||
    !isRecord(params.beforeSnapshot) ||
    !isRecord(params.afterSnapshot)
  ) {
    return
  }

  try {
    const { detectFieldChanges } = await import('@/lib/field-change-alerts')
    const changes = detectFieldChanges(
      params.entityType,
      params.beforeSnapshot,
      params.afterSnapshot,
    )

    for (const change of changes) {
      await (testHooks.writeAlertInstance ?? defaultWriteAlertInstance)({
        alert_type: 'FIELD_CHANGE',
        entity_type: params.entityType,
        entity_id: params.entityId,
        payload: change,
        audit_event_id: params.auditEventId,
      })
    }
  } catch (error) {
    logAuditMiddlewareError(
      '[Audit Middleware] Failed to write alert_instance; route response will still be returned',
      error,
    )
  }
}

export function withAuditTrail<TContext = unknown>(
  handler: AuditedRouteHandler<TContext>,
  config: AuditMiddlewareConfig<TContext>,
): AuditedRouteHandler<TContext> {
  return async (request, context) => {
    const beforeSnapshot = await readSnapshot(
      'before',
      config.beforeFn,
      request,
      context,
      {},
    )

    const response = await handler(request, context)

    if (!response.ok) {
      return response
    }

    try {
      const afterSnapshot = await readSnapshot('after', config.afterFn, request, context, {
        response,
        beforeSnapshot,
      })
      const auditContext = {
        response,
        beforeSnapshot,
        afterSnapshot,
      }
      if (config.shouldAuditFn) {
        const shouldAudit = await config.shouldAuditFn(request, context, auditContext)

        if (!shouldAudit) {
          return response
        }
      }

      const actorContext = await readActorContext(request, config.actor)
      const entityId = await resolveEntityId(request, context, config, auditContext)
      const entityType = await resolveEntityType(request, context, config, {
        ...auditContext,
        entityId,
      })
      const action = await resolveAction(request, context, config, {
        ...auditContext,
        entityId,
      })
      const metadata = config.metadataFn
        ? await config.metadataFn(request, context, {
            ...auditContext,
            entityId,
          })
        : null

      const auditEventId = auditEventIdFromResult(
        await (testHooks.writeAuditEvent ?? defaultWriteAuditEvent)({
        userId: actorContext.actorUserId,
        action,
        entityType,
        entityId,
        channel: config.actor === 'system' ? 'system' : 'staff_ui',
        actor_type: config.actor === 'system' ? 'system' : undefined,
        actor_ip: actorContext.actorIp,
        actor_user_agent: actorContext.actorUserAgent,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        request_id: actorContext.requestId,
        metadata: metadata ?? undefined,
        }),
      )

      await writeFieldChangeAlerts({
        action,
        entityType,
        entityId,
        auditEventId,
        beforeSnapshot,
        afterSnapshot,
      })

      await writeAuditTimelineFallback({
        auditEventId,
        action,
        entityType,
        entityId,
        actorUserId: actorContext.actorUserId,
        requestId: actorContext.requestId,
        beforeSnapshot,
        afterSnapshot,
        metadata: metadata ?? null,
      })
    } catch (error) {
      logAuditMiddlewareError(
        '[Audit Middleware] Failed to write audit_event; route response will still be returned',
        error,
      )
    }

    return response
  }
}
