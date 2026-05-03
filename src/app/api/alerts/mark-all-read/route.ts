import { NextResponse } from "next/server"

import { resolveCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST() {
  const user = await resolveCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const result = await db.alert_instance.updateMany({
    where: {
      recipient_user_id: user.id,
      cleared_at: null,
    },
    data: {
      cleared_at: new Date(),
    },
  })

  return NextResponse.json({ cleared: result.count })
}
