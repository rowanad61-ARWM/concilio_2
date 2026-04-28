import { NextResponse } from "next/server"

import { withAuditTrail } from "@/lib/audit-middleware"
import {
  ensureFolder,
  listFiles,
  uploadFile,
} from "@/lib/graph"
import {
  normalizeClientDocumentFolder,
} from "@/lib/documents"
import {
  documentFolderRouteParams,
  readCreatedFolders,
  responseFileId,
  responseJson,
  type DocumentFolderRouteContext,
} from "@/lib/document-note-audit-snapshots"

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function listDocuments(
  _request: Request,
  { params }: DocumentFolderRouteContext,
) {
  const { clientId, folder } = await params
  const resolvedClientId = decodeSegment(clientId).trim()
  const resolvedFolder = normalizeClientDocumentFolder(decodeSegment(folder))

  if (!resolvedClientId || !resolvedFolder) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 })
  }

  try {
    const createdFolders = await ensureFolder(resolvedClientId, resolvedFolder)
    const files = await listFiles(resolvedClientId, resolvedFolder)
    const response = NextResponse.json(files)
    if (createdFolders.length > 0) {
      response.headers.set("x-concilio-created-folders", JSON.stringify(createdFolders))
    }
    return response
  } catch (error) {
    console.error("[documents list error]", error)
    return NextResponse.json([], { status: 200 })
  }
}

async function uploadDocument(
  request: Request,
  { params }: DocumentFolderRouteContext,
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

export const GET = withAuditTrail<DocumentFolderRouteContext>(listDocuments, {
  entity_type: "SharePointFolder",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, context, auditContext) => {
    const { clientId, folder } = await documentFolderRouteParams(context)
    const createdFolders = readCreatedFolders(auditContext.response)
    return createdFolders.length > 0
      ? {
          client_id: clientId,
          folder,
          created_folders: createdFolders,
        }
      : null
  },
  entityIdFn: async (_request, context) => {
    const { clientId } = await documentFolderRouteParams(context)
    return clientId
  },
  shouldAuditFn: async (_request, _context, auditContext) =>
    readCreatedFolders(auditContext.response).length > 0,
  metadataFn: async (_request, context, auditContext) => {
    const { clientId, folder } = await documentFolderRouteParams(context)
    return {
      client_id: clientId,
      folder,
      created_folders: readCreatedFolders(auditContext.response),
    }
  },
})

export const POST = withAuditTrail<DocumentFolderRouteContext>(uploadDocument, {
  entity_type: "SharePointFile",
  action: "CREATE",
  beforeFn: async () => null,
  afterFn: async (_request, _context, auditContext) =>
    responseJson<Record<string, unknown>>(auditContext),
  entityIdFn: async (_request, _context, auditContext) => responseFileId(auditContext),
  metadataFn: async (_request, context, auditContext) => {
    const { clientId, folder } = await documentFolderRouteParams(context)
    const payload = await responseJson<{ id?: unknown; name?: unknown; webUrl?: unknown }>(
      auditContext,
    )

    return {
      client_id: clientId,
      folder,
      sharepoint_drive_item_id:
        typeof payload?.id === "string" ? payload.id : null,
      file_name: typeof payload?.name === "string" ? payload.name : null,
      web_url: typeof payload?.webUrl === "string" ? payload.webUrl : null,
    }
  },
})
