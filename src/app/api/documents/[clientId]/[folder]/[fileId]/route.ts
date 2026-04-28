import { NextResponse } from "next/server"

import { withAuditTrail } from "@/lib/audit-middleware"
import { deleteFile } from "@/lib/graph"
import { normalizeClientDocumentFolder } from "@/lib/documents"
import {
  documentFileRouteParams,
  type DocumentFileRouteContext,
} from "@/lib/document-note-audit-snapshots"

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function deleteDocument(
  _request: Request,
  { params }: DocumentFileRouteContext,
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

export const DELETE = withAuditTrail<DocumentFileRouteContext>(deleteDocument, {
  entity_type: "SharePointFile",
  action: "DELETE",
  beforeFn: async (_request, context) => {
    const { clientId, folder, fileId } = await documentFileRouteParams(context)
    return {
      client_id: clientId,
      folder,
      sharepoint_drive_item_id: fileId,
    }
  },
  afterFn: async () => null,
  entityIdFn: async (_request, context) => {
    const { fileId } = await documentFileRouteParams(context)
    return fileId
  },
  metadataFn: async (_request, context) => {
    const { clientId, folder, fileId } = await documentFileRouteParams(context)
    return {
      client_id: clientId,
      folder,
      sharepoint_drive_item_id: fileId,
    }
  },
})
