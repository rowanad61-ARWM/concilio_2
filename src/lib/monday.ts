import "server-only"

const MONDAY_API_URL = "https://api.monday.com/v2"
const MONDAY_API_VERSION = "2024-10"
const CLIENT_BOARD_ID = 5026433053
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000

type MondayGraphQLError = {
  message?: string
}

type MondayGraphQLResponse<T> = {
  data?: T
  errors?: MondayGraphQLError[]
}

let boardColumnsCache: Record<string, string> | null = null
let boardColumnsCacheBoardId: string | null = null
const mondayUserIdByEmailCache = new Map<string, number | null>()
const mondayUserEmailByIdCache = new Map<number, string | null>()
let clientBoardCache: Map<string, string> | null = null
let clientBoardCacheLoadedAt = 0

function getRequiredEnv(name: "MONDAY_API_TOKEN" | "MONDAY_BOARD_ID") {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function logMondayOperationError(operation: string, error: unknown) {
  console.error(`[monday] ${operation} ${toErrorMessage(error)}`)
}

function normalizeNameForLookup(value: string) {
  return value.trim().toLowerCase()
}

async function mondayRequest<TData>(params: {
  operation: string
  query: string
  variables?: Record<string, unknown>
}) {
  const token = getRequiredEnv("MONDAY_API_TOKEN")

  try {
    const response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "API-Version": MONDAY_API_VERSION,
      },
      body: JSON.stringify({
        query: params.query,
        variables: params.variables ?? {},
      }),
      cache: "no-store",
    })

    const payload = (await response.json()) as MondayGraphQLResponse<TData>

    if (!response.ok) {
      const message = payload.errors?.[0]?.message || `HTTP ${response.status}`
      throw new Error(message)
    }

    if (payload.errors && payload.errors.length > 0) {
      throw new Error(payload.errors.map((error) => error.message || "unknown graphql error").join("; "))
    }

    if (!payload.data) {
      throw new Error("missing data in Monday response")
    }

    return payload.data
  } catch (error) {
    logMondayOperationError(params.operation, error)
    throw error
  }
}

function getColumnTitleToIdMap(columnsById: Record<string, string>) {
  const map = new Map<string, string>()

  for (const [columnId, title] of Object.entries(columnsById)) {
    map.set(title.trim().toLowerCase(), columnId)
  }

  return map
}

async function resolveColumnValuesByTitle(columnValuesByTitle: Record<string, unknown>) {
  const columnsById = await getBoardColumns()
  const titleToId = getColumnTitleToIdMap(columnsById)

  const resolved: Record<string, unknown> = {}

  for (const [columnTitle, value] of Object.entries(columnValuesByTitle)) {
    const columnId = titleToId.get(columnTitle.trim().toLowerCase())
    if (!columnId) {
      console.error(`[monday] resolve-column missing-column-title ${columnTitle}`)
      continue
    }

    resolved[columnId] = value
  }

  return resolved
}

export async function getBoardColumns(): Promise<Record<string, string>> {
  const boardId = getRequiredEnv("MONDAY_BOARD_ID")

  if (boardColumnsCache && boardColumnsCacheBoardId === boardId) {
    return boardColumnsCache
  }

  const data = await mondayRequest<{
    boards?: Array<{
      columns?: Array<{
        id?: string
        title?: string
      }>
    }>
  }>({
    operation: "getBoardColumns",
    query: `
      query GetBoardColumns($boardId: [ID!]!) {
        boards(ids: $boardId) {
          columns {
            id
            title
          }
        }
      }
    `,
    variables: {
      boardId: [boardId],
    },
  })

  const columns = data.boards?.[0]?.columns ?? []
  const mapped: Record<string, string> = {}

  for (const column of columns) {
    if (!column?.id || !column?.title) {
      continue
    }

    mapped[column.id] = column.title
  }

  boardColumnsCache = mapped
  boardColumnsCacheBoardId = boardId

  return mapped
}

export async function getMondayUserIdByEmail(email: string): Promise<number | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }

  if (mondayUserIdByEmailCache.has(normalizedEmail)) {
    return mondayUserIdByEmailCache.get(normalizedEmail) ?? null
  }

  const data = await mondayRequest<{
    users?: Array<{
      id?: string | number
      email?: string | null
    }>
  }>({
    operation: "getMondayUserIdByEmail",
    query: `
      query GetMondayUserIdByEmail($emails: [String!]!) {
        users(emails: $emails) {
          id
          email
        }
      }
    `,
    variables: {
      emails: [normalizedEmail],
    },
  })

  const user = (data.users ?? []).find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail)

  if (!user?.id) {
    mondayUserIdByEmailCache.set(normalizedEmail, null)
    return null
  }

  const userId = Number(user.id)
  if (!Number.isInteger(userId) || userId <= 0) {
    mondayUserIdByEmailCache.set(normalizedEmail, null)
    return null
  }

  mondayUserIdByEmailCache.set(normalizedEmail, userId)
  mondayUserEmailByIdCache.set(userId, normalizedEmail)
  return userId
}

export async function getMondayUserEmailById(userId: number): Promise<string | null> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return null
  }

  if (mondayUserEmailByIdCache.has(userId)) {
    return mondayUserEmailByIdCache.get(userId) ?? null
  }

  const data = await mondayRequest<{
    users?: Array<{
      id?: string | number
      email?: string | null
    }>
  }>({
    operation: "getMondayUserEmailById",
    query: `
      query GetMondayUserEmailById($ids: [ID!]) {
        users(ids: $ids) {
          id
          email
        }
      }
    `,
    variables: {
      ids: [String(userId)],
    },
  })

  const user = (data.users ?? []).find((candidate) => Number(candidate.id) === userId)
  const email = user?.email?.trim().toLowerCase() ?? null

  mondayUserEmailByIdCache.set(userId, email)
  if (email) {
    mondayUserIdByEmailCache.set(email, userId)
  }

  return email
}

async function loadClientBoardItems(): Promise<Map<string, string>> {
  const mapped = new Map<string, string>()
  const pageSize = 500

  const firstPageData = await mondayRequest<{
    boards?: Array<{
      items_page?: {
        cursor?: string | null
        items?: Array<{
          id?: string | number
          name?: string
        }>
      }
    }>
  }>({
    operation: "loadClientBoardItems:firstPage",
    query: `
      query LoadClientBoardItemsFirstPage($boardId: [ID!]!, $limit: Int!) {
        boards(ids: $boardId) {
          items_page(limit: $limit) {
            cursor
            items {
              id
              name
            }
          }
        }
      }
    `,
    variables: {
      boardId: [String(CLIENT_BOARD_ID)],
      limit: pageSize,
    },
  })

  let cursor = firstPageData.boards?.[0]?.items_page?.cursor ?? null
  const firstPageItems = firstPageData.boards?.[0]?.items_page?.items ?? []

  for (const item of firstPageItems) {
    if (!item?.id || !item?.name) {
      continue
    }

    mapped.set(normalizeNameForLookup(item.name), String(item.id))
  }

  while (cursor) {
    const nextPageData = await mondayRequest<{
      next_items_page?: {
        cursor?: string | null
        items?: Array<{
          id?: string | number
          name?: string
        }>
      }
    }>({
      operation: "loadClientBoardItems:nextPage",
      query: `
        query LoadClientBoardItemsNextPage($cursor: String!, $limit: Int!) {
          next_items_page(cursor: $cursor, limit: $limit) {
            cursor
            items {
              id
              name
            }
          }
        }
      `,
      variables: {
        cursor,
        limit: pageSize,
      },
    })

    const pageItems = nextPageData.next_items_page?.items ?? []
    for (const item of pageItems) {
      if (!item?.id || !item?.name) {
        continue
      }

      mapped.set(normalizeNameForLookup(item.name), String(item.id))
    }

    cursor = nextPageData.next_items_page?.cursor ?? null
  }

  clientBoardCache = mapped
  clientBoardCacheLoadedAt = Date.now()

  return mapped
}

async function getClientBoardCache(forceRefresh: boolean) {
  const isStale = Date.now() - clientBoardCacheLoadedAt > CLIENT_CACHE_TTL_MS
  if (forceRefresh || !clientBoardCache || isStale) {
    return loadClientBoardItems()
  }

  return clientBoardCache
}

function buildLastFirstFallback(displayName: string) {
  const trimmed = displayName.trim()
  const firstSpaceIndex = trimmed.indexOf(" ")

  if (firstSpaceIndex <= 0 || firstSpaceIndex === trimmed.length - 1) {
    return null
  }

  const firstName = trimmed.slice(0, firstSpaceIndex).trim()
  const lastName = trimmed.slice(firstSpaceIndex + 1).trim()
  if (!firstName || !lastName) {
    return null
  }

  return `${lastName}, ${firstName}`
}

// TODO(post-xplan-import): Once the Xplan migration populates structured name fields on
// `person` (legal_given_name, legal_middle_names, legal_family_name), rewrite this resolver
// to build the "Last, First" form directly from person fields instead of parsing display_name.
// That removes the single-space parsing guesswork and handles hyphenated surnames / middle
// names / couples cleanly.
export async function resolveMondayClientItemId(concilioDisplayName: string): Promise<string | null> {
  const normalizedExact = normalizeNameForLookup(concilioDisplayName)
  if (!normalizedExact) {
    return null
  }

  const fallbackName = buildLastFirstFallback(concilioDisplayName)
  const normalizedFallback = fallbackName ? normalizeNameForLookup(fallbackName) : null

  const tryLookup = async (forceRefresh: boolean) => {
    const cache = await getClientBoardCache(forceRefresh)
    const exactMatch = cache.get(normalizedExact)
    if (exactMatch) {
      return exactMatch
    }

    if (normalizedFallback) {
      const fallbackMatch = cache.get(normalizedFallback)
      if (fallbackMatch) {
        return fallbackMatch
      }
    }

    return null
  }

  const firstTry = await tryLookup(false)
  if (firstTry) {
    return firstTry
  }

  return tryLookup(true)
}

export async function createMondayItem(params: {
  itemName: string
  columnValues: Record<string, unknown>
}): Promise<string> {
  const boardId = getRequiredEnv("MONDAY_BOARD_ID")
  const resolvedColumnValues = await resolveColumnValuesByTitle(params.columnValues)

  const data = await mondayRequest<{
    create_item?: {
      id?: string | number
    }
  }>({
    operation: "createMondayItem",
    query: `
      mutation CreateMondayItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `,
    variables: {
      boardId,
      itemName: params.itemName,
      columnValues: JSON.stringify(resolvedColumnValues),
    },
  })

  const itemId = data.create_item?.id
  if (!itemId) {
    throw new Error("Monday create_item returned no id")
  }

  return String(itemId)
}

export async function updateMondayItem(params: {
  itemId: string
  columnValues: Record<string, unknown>
}): Promise<void> {
  const boardId = getRequiredEnv("MONDAY_BOARD_ID")
  const resolvedColumnValues = await resolveColumnValuesByTitle(params.columnValues)

  if (Object.keys(resolvedColumnValues).length === 0) {
    return
  }

  await mondayRequest({
    operation: "updateMondayItem",
    query: `
      mutation UpdateMondayItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
        }
      }
    `,
    variables: {
      boardId,
      itemId: params.itemId,
      columnValues: JSON.stringify(resolvedColumnValues),
    },
  })
}

export async function archiveMondayItem(itemId: string): Promise<void> {
  await mondayRequest({
    operation: "archiveMondayItem",
    query: `
      mutation ArchiveMondayItem($itemId: ID!) {
        archive_item(item_id: $itemId) {
          id
        }
      }
    `,
    variables: {
      itemId,
    },
  })
}
