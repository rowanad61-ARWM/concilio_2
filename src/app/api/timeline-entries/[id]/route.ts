import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  findAccessibleClientParty,
  isUuid,
  serializeTimelineAttachment,
  serializeTimelineEntry,
  type TimelineRouteContext,
} from "@/lib/timeline-api"

export async function GET(_request: Request, { params }: TimelineRouteContext) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ error: "timeline entry not found" }, { status: 404 })
  }

  const entry = await db.timeline_entry.findUnique({
    where: { id },
    include: {
      actor_user: {
        select: {
          name: true,
        },
      },
      timeline_attachment: {
        orderBy: {
          inserted_at: "asc",
        },
      },
    },
  })

  if (!entry) {
    return NextResponse.json({ error: "timeline entry not found" }, { status: 404 })
  }

  const party = await findAccessibleClientParty(entry.party_id)
  if (!party) {
    return NextResponse.json({ error: "timeline entry not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...serializeTimelineEntry(entry),
    attachments: entry.timeline_attachment.map(serializeTimelineAttachment),
  })
}
