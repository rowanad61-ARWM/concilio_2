import { NextResponse } from "next/server"

import {
  ensureFolder,
  listFiles,
  uploadFile,
} from "@/lib/graph"
import {
  normalizeClientDocumentFolder,
} from "@/lib/documents"

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; folder: string }> },
) {
  const { clientId, folder } = await params
  const resolvedClientId = decodeSegment(clientId).trim()
  const resolvedFolder = normalizeClientDocumentFolder(decodeSegment(folder))

  if (!resolvedClientId || !resolvedFolder) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 })
  }

  try {
    await ensureFolder(resolvedClientId, resolvedFolder)
    const files = await listFiles(resolvedClientId, resolvedFolder)
    return NextResponse.json(files)
  } catch (error) {
    console.error("[documents list error]", error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; folder: string }> },
) {
  const { clientId, folder } = await params
  const resolvedClientId = decodeSegment(clientId).trim()
  const resolvedFolder = normalizeClientDocumentFolder(decodeSegment(folder))

  if (!resolvedClientId || !resolvedFolder) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 })
  }

  try {
    const formData = await request.formData()
    const fileValue = formData.get("file")

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await fileValue.arrayBuffer())
    await ensureFolder(resolvedClientId, resolvedFolder)
    const uploaded = await uploadFile(resolvedClientId, resolvedFolder, fileValue.name, fileBuffer)

    return NextResponse.json(uploaded)
  } catch (error) {
    console.error("[documents upload error]", error)
    return NextResponse.json({ error: "failed to upload document" }, { status: 500 })
  }
}
