import { NextResponse } from "next/server"

import { deleteFile } from "@/lib/graph"
import { normalizeClientDocumentFolder } from "@/lib/documents"

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; folder: string; fileId: string }> },
) {
  const { clientId, folder, fileId } = await params
  const resolvedClientId = decodeSegment(clientId).trim()
  const resolvedFolder = normalizeClientDocumentFolder(decodeSegment(folder))
  const resolvedFileId = decodeSegment(fileId).trim()

  if (!resolvedClientId || !resolvedFolder || !resolvedFileId) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 })
  }

  try {
    await deleteFile(resolvedFileId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[documents delete error]", error)
    return NextResponse.json({ error: "failed to delete document" }, { status: 500 })
  }
}
