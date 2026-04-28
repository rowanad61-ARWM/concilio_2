import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { AuditAction, AuditEventInput, AuditSnapshot } from '@/lib/audit'

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
}

let testHooks: AuditMiddlewareTestHooks = {}
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  await db.alert_instance.create({
    data: {
      alert_type: input.alert_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      payload: toJsonCompatible(input.payload),
      audit_event_id: input.audit_event_id,
    },
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
    } catch (error) {
      logAuditMiddlewareError(
        '[Audit Middleware] Failed to write audit_event; route response will still be returned',
        error,
      )
    }

    return response
  }
}
