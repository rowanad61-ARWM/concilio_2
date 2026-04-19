import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"

type TaskTypeGroup = {
  type: string
  subtypes: string[]
}

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const rows = await db.taskTypeOption.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        type: true,
        subtype: true,
      },
    })

    const grouped = new Map<string, TaskTypeGroup>()

    for (const row of rows) {
      if (!grouped.has(row.type)) {
        grouped.set(row.type, { type: row.type, subtypes: [] })
      }

      if (row.subtype) {
        const entry = grouped.get(row.type)
        if (entry && !entry.subtypes.includes(row.subtype)) {
          entry.subtypes.push(row.subtype)
        }
      }
    }

    return NextResponse.json(Array.from(grouped.values()))
  } catch (error) {
    console.error("[task types list error]", error)
    return NextResponse.json({ error: "failed to load task type options" }, { status: 500 })
  }
}
