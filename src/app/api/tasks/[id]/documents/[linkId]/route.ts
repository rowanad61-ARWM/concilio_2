import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  )
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, linkId } = await params

  try {
    const existing = await db.taskDocumentLink.findFirst({
      where: {
        id: linkId,
        taskId: id,
      },
      select: {
        id: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "linked document not found" }, { status: 404 })
    }

    await db.taskDocumentLink.delete({
      where: {
        id: linkId,
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "linked document not found" }, { status: 404 })
    }

    console.error("[task document unlink error]", error)
    return NextResponse.json({ error: "failed to unlink document" }, { status: 500 })
  }
}