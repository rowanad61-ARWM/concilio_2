import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getDeletePreview, PartyNotFoundError } from "@/lib/partyDelete"

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
    const preview = await getDeletePreview(id)
    return NextResponse.json(preview)
  } catch (error) {
    if (error instanceof PartyNotFoundError) {
      return NextResponse.json({ error: "client not found" }, { status: 404 })
    }

    console.error(`[client delete preview error] ${id} ${toErrorMessage(error)}`)
    return NextResponse.json({ error: "failed to load delete preview" }, { status: 500 })
  }
}

