import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { getTaskOutcomeCatalog } from "@/lib/workflow"

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!task) {
      return NextResponse.json({ error: "task not found" }, { status: 404 })
    }

    const catalog = await getTaskOutcomeCatalog(id)
    return NextResponse.json(catalog)
  } catch (error) {
    console.error(`[task outcomes list error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load task outcomes" }, { status: 500 })
  }
}
