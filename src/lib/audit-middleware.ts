import { randomUUID } from 'node:crypto'
import type { AuditAction, AuditEventInput, AuditSnapshot } from '@/lib/audit'

type MaybePromise<T> = T | Promise<T>

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

export type AuditMetadataFn<TContext = unknown> = (
  request: Request,
  context: TContext,
  auditContext: AuditLifecycleContext,
) => MaybePromise<Record<string, unknown> | null | undefined>

export interface AuditMiddlewareConfig<TContext = unknown> {
  entity_type: string | AuditEntityTypeFn<TContext>
  action: AuditAction
  beforeFn?: AuditSnapshotFn<TContext>
  afterFn?: AuditSnapshotFn<TContext>
  entityIdFn?: AuditEntityIdFn<TContext>
  metadataFn?: AuditMetadataFn<TContext>
}

interface SessionLike {
  user?: {
    id?: unknown
    email?: unknown
  }
}

interface AuditMiddlewareTestHooks {
  auth?: () => MaybePromise<SessionLike | null>
  writeAuditEvent?: (input: AuditEventInput) => Promise<void>
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

async function defaultWriteAuditEvent(input: AuditEventInput): Promise<void> {
  const { writeAuditEvent } = await import('@/lib/audit')
  await writeAuditEvent(input)
}

function maybeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isUuid(value: string | null): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
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

async function readActorContext(request: Request): Promise<{
  actorUserId: string | null
  actorIp: string | null
  actorUserAgent: string | null
  requestId: string
}> {
  const session = await (testHooks.auth ?? defaultAuth)()

  return {
    actorUserId: await resolveActorUserIdFromSession(session),
    actorIp: readClientIp(request.headers),
    actorUserAgent: request.headers.get('user-agent'),
    requestId: request.headers.get('x-request-id') ?? (testHooks.requestId ?? randomUUID)(),
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
      const actorContext = await readActorContext(request)
      const auditContext = {
        response,
        beforeSnapshot,
        afterSnapshot,
      }
      const entityId = await resolveEntityId(request, context, config, auditContext)
      const entityType = await resolveEntityType(request, context, config, {
        ...auditContext,
        entityId,
      })
      const metadata = config.metadataFn
        ? await config.metadataFn(request, context, {
            ...auditContext,
            entityId,
          })
        : null

      await (testHooks.writeAuditEvent ?? defaultWriteAuditEvent)({
        userId: actorContext.actorUserId,
        action: config.action,
        entityType,
        entityId,
        channel: 'staff_ui',
        actor_ip: actorContext.actorIp,
        actor_user_agent: actorContext.actorUserAgent,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        request_id: actorContext.requestId,
        metadata: metadata ?? undefined,
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
