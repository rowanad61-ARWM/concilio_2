import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const clientId = url.searchParams.get("clientId")?.trim() ?? ""
  const householdId = url.searchParams.get("householdId")?.trim() ?? ""

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }

  try {
    const scopedClientIds = householdId
      ? [...new Set([clientId, householdId].filter((value) => Boolean(value)))]
      : [clientId]

    const logs = await db.emailLog.findMany({
      where: {
        clientId:
          scopedClientIds.length === 1
            ? scopedClientIds[0]
            : {
                in: scopedClientIds,
              },
      },
      orderBy: {
        sentAt: "desc",
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
    })

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        sentAt: log.sentAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[email logs fetch error]", error)
    return NextResponse.json({ error: "failed to load email logs" }, { status: 500 })
  }
}
