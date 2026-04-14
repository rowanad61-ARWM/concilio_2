import { NextResponse } from "next/server"

import { db } from "@/lib/db"

export async function GET() {
  try {
    const templates = await db.$queryRawUnsafe<
      {
        id: string
        name: string
        version: number
        description: string | null
        stages: unknown
        status: string
      }[]
    >(
      `SELECT id, name, version, description, stages, status
       FROM workflow_template
       WHERE status IN ('active', 'deployed')
       ORDER BY name ASC, version DESC`,
    )

    return NextResponse.json(templates)
  } catch (error) {
    console.error("[workflow templates list error]", error)
    return NextResponse.json({ error: "failed to fetch workflow templates" }, { status: 500 })
  }
}

