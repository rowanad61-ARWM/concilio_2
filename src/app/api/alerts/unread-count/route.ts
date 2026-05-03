import { NextResponse } from "next/server"

import { resolveCurrentUser } from "@/lib/current-user"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await resolveCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const count = await db.alert_instance.count({
    where: {
      recipient_user_id: user.id,
      cleared_at: null,
    },
  })

  return NextResponse.json({ count })
}
