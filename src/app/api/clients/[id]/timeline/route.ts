import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  findAccessibleClientParty,
  parseIsoDateParam,
  parseTimelineKindFilter,
  parseTimelineLimit,
  serializeTimelineEntry,
  type TimelineRouteContext,
} from "@/lib/timeline-api"

export async function GET(request: Request, { params }: TimelineRouteContext) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id: partyId } = await params
  const party = await findAccessibleClientParty(partyId)
  if (!party) {
    return NextResponse.json({ error: "client not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const kindFilter = parseTimelineKindFilter(searchParams)
  if (!kindFilter.ok) {
    return NextResponse.json({ error: kindFilter.error }, { status: 400 })
  }

  const from = parseIsoDateParam(searchParams.get("from"), "from")
  if (!from.ok) {
    return NextResponse.json({ error: from.error }, { status: 400 })
  }

  const to = parseIsoDateParam(searchParams.get("to"), "to")
  if (!to.ok) {
    return NextResponse.json({ error: to.error }, { status: 400 })
  }

  const cursor = parseIsoDateParam(searchParams.get("cursor"), "cursor")
  if (!cursor.ok) {
    return NextResponse.json({ error: cursor.error }, { status: 400 })
  }

  const limit = parseTimelineLimit(searchParams.get("limit"))
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: 400 })
  }

  const where: Prisma.timeline_entryWhereInput = {
    party_id: party.id,
  }

  if (kindFilter.value) {
    where.kind = { in: kindFilter.value }
  }

  const occurredAt: { gte?: Date; lte?: Date; lt?: Date } = {}
  if (from.value) {
    occurredAt.gte = from.value
  }
  if (to.value) {
    occurredAt.lte = to.value
  }
  if (cursor.value) {
    occurredAt.lt = cursor.value
  }
  if (Object.keys(occurredAt).length > 0) {
    where.occurred_at = occurredAt
  }

  const query = searchParams.get("q")?.trim()
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
    ]
  }

  try {
    const entries = await db.timeline_entry.findMany({
      where,
      include: {
        actor_user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        occurred_at: "desc",
      },
      take: limit.value + 1,
    })

    const page = entries.slice(0, limit.value)
    const nextCursor =
      entries.length > limit.value && page.length > 0
        ? page[page.length - 1].occurred_at.toISOString()
        : null

    return NextResponse.json({
      entries: page.map(serializeTimelineEntry),
      nextCursor,
    })
  } catch (error) {
    console.error("[timeline list error]", error)
    return NextResponse.json({ error: "failed to load timeline" }, { status: 500 })
  }
}
