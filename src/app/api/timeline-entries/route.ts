import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import { responseId, responseJson } from "@/lib/client-audit-snapshots"
import {
  findAccessibleClientParty,
  isQuickAddTimelineKind,
  isRecord,
  isUuid,
  resolveActiveHouseholdId,
  resolveSessionActorUserId,
  serializeTimelineEntry,
  toOptionalTrimmedString,
} from "@/lib/timeline-api"
import { writeTimelineEntry } from "@/lib/timeline"

async function createTimelineEntry(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: "request body must be an object" }, { status: 400 })
    }
    payload = parsed
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const partyId = toOptionalTrimmedString(payload.party_id)
  if (!partyId || !isUuid(partyId)) {
    return NextResponse.json({ error: "party_id must be a valid UUID" }, { status: 400 })
  }

  const party = await findAccessibleClientParty(partyId)
  if (!party) {
    return NextResponse.json({ error: "client not found" }, { status: 404 })
  }

  const kind = toOptionalTrimmedString(payload.kind)
  if (!kind || !isQuickAddTimelineKind(kind)) {
    return NextResponse.json(
      { error: "kind must be one of phone_call, meeting, file_note" },
      { status: 400 },
    )
  }

  const title = toOptionalTrimmedString(payload.title)
  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "title is required and must be 200 characters or fewer" },
      { status: 400 },
    )
  }

  let body: string | null = null
  if (payload.body !== undefined && payload.body !== null) {
    if (typeof payload.body !== "string") {
      return NextResponse.json({ error: "body must be a string or null" }, { status: 400 })
    }
    if (payload.body.length > 50000) {
      return NextResponse.json(
        { error: "body must be 50000 characters or fewer" },
        { status: 400 },
      )
    }
    body = payload.body
  }

  let occurredAt = new Date()
  if (payload.occurred_at !== undefined && payload.occurred_at !== null) {
    if (typeof payload.occurred_at !== "string") {
      return NextResponse.json({ error: "occurred_at must be an ISO timestamp" }, { status: 400 })
    }
    occurredAt = new Date(payload.occurred_at)
    if (Number.isNaN(occurredAt.valueOf())) {
      return NextResponse.json({ error: "occurred_at must be a valid ISO timestamp" }, { status: 400 })
    }
  }

  let metadata: Record<string, unknown> | null = null
  if (payload.metadata !== undefined && payload.metadata !== null) {
    if (!isRecord(payload.metadata)) {
      return NextResponse.json({ error: "metadata must be an object or null" }, { status: 400 })
    }
    metadata = payload.metadata
  }

  const [householdId, actorUserId] = await Promise.all([
    resolveActiveHouseholdId(party.id),
    resolveSessionActorUserId(session),
  ])

  const entry = await writeTimelineEntry({
    party_id: party.id,
    household_id: householdId,
    kind,
    source: "native",
    title,
    body,
    actor_user_id: actorUserId,
    occurred_at: occurredAt,
    metadata,
  })

  if (!entry) {
    return NextResponse.json({ error: "failed to create timeline entry" }, { status: 500 })
  }

  return NextResponse.json(serializeTimelineEntry(entry), { status: 201 })
}

export const POST = withAuditTrail(createTimelineEntry, {
  entity_type: "timeline_entry",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) => responseJson(auditContext),
  entityIdFn: async (_request, _context, auditContext) => responseId(auditContext),
  metadataFn: async (_request, _context, auditContext) => {
    const payload = await responseJson<{ party_id?: unknown; kind?: unknown }>(auditContext)
    return {
      party_id: typeof payload?.party_id === "string" ? payload.party_id : null,
      kind: typeof payload?.kind === "string" ? payload.kind : null,
    }
  },
})
