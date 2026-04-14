import "server-only"

import { Client } from "@microsoft/microsoft-graph-client"
import { ClientSecretCredential } from "@azure/identity"

import type { ClientDocumentFolder } from "@/lib/documents"

type GraphDriveItem = {
  id: string
  name: string
  size?: number
  lastModifiedDateTime?: string
  webUrl?: string
  "@microsoft.graph.downloadUrl"?: string
  file?: unknown
}

type GraphCollectionResponse<T> = {
  value?: T[]
}

type GraphDrive = {
  id?: string
  name?: string
}

let cachedGraphClient: Client | null = null
let cachedSiteId: string | null = null
let cachedDriveId: string | null = null

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function getGraphScope() {
  return "https://graph.microsoft.com/.default"
}

function encodePathSegments(segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join("/")
}

function isGraphErrorWithStatus(error: unknown, statusCode: number) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "statusCode" in error &&
      (error as { statusCode?: unknown }).statusCode === statusCode,
  )
}

async function getGraphItemByPath(pathSegments: string[]) {
  const client = getGraphClient()
  const driveId = await getDriveId(await getSiteId())

  try {
    return await client.api(`/drives/${driveId}/root:/${encodePathSegments(pathSegments)}`).get()
  } catch (error) {
    if (isGraphErrorWithStatus(error, 404)) {
      return null
    }

    throw error
  }
}

async function createFolder(parentSegments: string[], folderName: string) {
  const client = getGraphClient()
  const driveId = await getDriveId(await getSiteId())
  const endpoint =
    parentSegments.length > 0
      ? `/drives/${driveId}/root:/${encodePathSegments(parentSegments)}:/children`
      : `/drives/${driveId}/root/children`

  try {
    await client.api(endpoint).post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    })
  } catch (error) {
    if (isGraphErrorWithStatus(error, 409)) {
      return
    }

    throw error
  }
}

async function ensureFolderPath(pathSegments: string[]) {
  if (pathSegments.length === 0) {
    return
  }

  const existing = await getGraphItemByPath(pathSegments)
  if (existing) {
    return
  }

  const parentSegments = pathSegments.slice(0, -1)
  const folderName = pathSegments[pathSegments.length - 1]
  await ensureFolderPath(parentSegments)
  await createFolder(parentSegments, folderName)
}

export function getGraphClient() {
  if (cachedGraphClient) {
    return cachedGraphClient
  }

  const tenantId = getRequiredEnv("AZURE_TENANT_ID")
  const clientId = getRequiredEnv("AZURE_CLIENT_ID")
  const clientSecret = getRequiredEnv("AZURE_CLIENT_SECRET")
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)

  cachedGraphClient = Client.init({
    authProvider: async (done) => {
      try {
        const token = await credential.getToken(getGraphScope())
        done(null, token?.token ?? null)
      } catch (error) {
        done(error as Error, null)
      }
    },
  })

  return cachedGraphClient
}

export async function getSiteId(): Promise<string> {
  if (cachedSiteId) {
    return cachedSiteId
  }

  const envSiteId = process.env.SHAREPOINT_SITE_ID?.trim()
  if (envSiteId) {
    cachedSiteId = envSiteId
    return envSiteId
  }

  const client = getGraphClient()
  const site = await client.api("/sites/arwm.sharepoint.com:/sites/ARWMNewSite").get()

  if (!site?.id || typeof site.id !== "string") {
    throw new Error("Unable to resolve SharePoint site id")
  }

  cachedSiteId = site.id
  return site.id
}

export async function getDriveId(siteId: string): Promise<string> {
  if (cachedDriveId) {
    return cachedDriveId
  }

  const driveName = process.env.SHAREPOINT_DRIVE_NAME?.trim() || "Clients"
  const client = getGraphClient()
  const drives = await client.api(`/sites/${siteId}/drives`).get() as GraphCollectionResponse<GraphDrive>
  const values = Array.isArray(drives.value) ? drives.value : []
  const drive = values.find((item: GraphDrive) => typeof item?.name === "string" && item.name === driveName)

  if (!drive || typeof drive.id !== "string") {
    throw new Error(`Unable to resolve SharePoint drive '${driveName}'`)
  }

  cachedDriveId = drive.id
  return drive.id
}

export async function ensureFolder(clientId: string, folder: ClientDocumentFolder) {
  const normalizedClientId = clientId.trim()
  if (!normalizedClientId) {
    throw new Error("clientId is required")
  }

  await ensureFolderPath([normalizedClientId])
  await ensureFolderPath([normalizedClientId, folder])
}

export async function listFiles(clientId: string, folder: ClientDocumentFolder) {
  const client = getGraphClient()
  const driveId = await getDriveId(await getSiteId())
  const path = [clientId.trim(), folder]

  try {
    const response = await client
      .api(`/drives/${driveId}/root:/${encodePathSegments(path)}:/children`)
      .get() as GraphCollectionResponse<GraphDriveItem>

    const items = Array.isArray(response.value) ? response.value : []

    return items
      .filter((item) => Boolean(item.file))
      .map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size ?? 0,
        lastModifiedDateTime: item.lastModifiedDateTime ?? null,
        webUrl: item.webUrl ?? null,
        "@microsoft.graph.downloadUrl": item["@microsoft.graph.downloadUrl"] ?? null,
      }))
  } catch (error) {
    if (isGraphErrorWithStatus(error, 404)) {
      return []
    }

    throw error
  }
}

export async function uploadFile(
  clientId: string,
  folder: ClientDocumentFolder,
  filename: string,
  buffer: Buffer,
) {
  const client = getGraphClient()
  const driveId = await getDriveId(await getSiteId())
  const safeFilename = filename.replace(/[\\/]/g, "_")
  const pathSegments = [clientId.trim(), folder, safeFilename]

  const uploaded = await client
    .api(`/drives/${driveId}/root:/${encodePathSegments(pathSegments)}:/content`)
    .header("Content-Type", "application/octet-stream")
    .put(buffer) as GraphDriveItem

  return {
    id: uploaded.id,
    name: uploaded.name,
    size: uploaded.size ?? 0,
    lastModifiedDateTime: uploaded.lastModifiedDateTime ?? null,
    webUrl: uploaded.webUrl ?? null,
    "@microsoft.graph.downloadUrl": uploaded["@microsoft.graph.downloadUrl"] ?? null,
  }
}

export async function deleteFile(fileId: string) {
  const client = getGraphClient()
  const driveId = await getDriveId(await getSiteId())
  await client.api(`/drives/${driveId}/items/${fileId}`).delete()
}
