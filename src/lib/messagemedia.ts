import "server-only"

const MESSAGEMEDIA_DEFAULT_BASE_URL = "https://api.messagemedia.com"
const MESSAGEMEDIA_MESSAGES_PATH = "/v1/messages"

type MessageMediaResponse = {
  messages?: Array<{
    message_id?: string
    status?: string
  }>
}

class MessageMediaSendError extends Error {
  httpStatus?: number
  responseBody?: string

  constructor(message: string, options?: { httpStatus?: number; responseBody?: string }) {
    super(message)
    this.name = "MessageMediaSendError"
    this.httpStatus = options?.httpStatus
    this.responseBody = options?.responseBody
  }
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

function maskPhone(value: string) {
  const normalized = value.trim()
  if (normalized.length <= 4) {
    return "****"
  }

  return `${normalized.slice(0, 3)}***${normalized.slice(-4)}`
}

function sanitizePhoneInput(value: string) {
  return value.replace(/[\s\-().]/g, "")
}

function compactRawBody(rawText: string) {
  return rawText.replace(/\s+/g, " ").trim().slice(0, 2000)
}

function parseMessageMediaResponse(rawText: string): MessageMediaResponse | null {
  try {
    const parsed = JSON.parse(rawText) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    return parsed as MessageMediaResponse
  } catch {
    return null
  }
}

export function normalizeSmsPhone(input: string): string {
  const cleaned = sanitizePhoneInput(input.trim())
  if (!cleaned) {
    throw new Error("phone number is empty")
  }

  if (cleaned.startsWith("+")) {
    if (!/^\+\d{8,15}$/.test(cleaned)) {
      throw new Error("phone number must be valid E.164")
    }
    return cleaned
  }

  if (/^00\d{8,15}$/.test(cleaned)) {
    return `+${cleaned.slice(2)}`
  }

  if (/^0\d{8,14}$/.test(cleaned)) {
    const converted = `+61${cleaned.slice(1)}`
    if (!/^\+\d{8,15}$/.test(converted)) {
      throw new Error("phone number format is not supported")
    }
    return converted
  }

  if (/^61\d{8,14}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  if (/^\d{8,15}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  throw new Error("phone number format is not supported")
}

export async function sendSms(to: string, body: string): Promise<{ message_id: string; status: string }> {
  const username = process.env.MESSAGEMEDIA_USERNAME?.trim()
  const password = process.env.MESSAGEMEDIA_PASSWORD?.trim()
  const sourceNumber = process.env.MESSAGEMEDIA_SOURCE_NUMBER?.trim()
  const endpointBase = process.env.MESSAGEMEDIA_ENDPOINT?.trim() || MESSAGEMEDIA_DEFAULT_BASE_URL
  const endpoint = new URL(MESSAGEMEDIA_MESSAGES_PATH, endpointBase).toString()

  if (!username || !password || !sourceNumber) {
    throw new Error("MessageMedia credentials are not configured")
  }

  if (!body.trim()) {
    throw new Error("SMS body is empty")
  }

  const destinationNumber = normalizeSmsPhone(to)
  const authorization = Buffer.from(`${username}:${password}`, "utf8").toString("base64")

  const requestBody = {
    messages: [
      {
        content: body,
        destination_number: destinationNumber,
        source_number: sourceNumber,
        delivery_report: false,
      },
    ],
  }

  console.info(
    `[messagemedia sms] send request endpoint=${endpoint} destination=${maskPhone(destinationNumber)} source=${sourceNumber} textLength=${body.length}`,
  )

  let response: Response
  let rawText = ""
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    })
    rawText = await response.text()
  } catch (error) {
    console.error(`[messagemedia sms] send failed network-error ${toErrorMessage(error)}`)
    throw new MessageMediaSendError(`MessageMedia network failure: ${toErrorMessage(error)}`)
  }

  const responseBodySummary = compactRawBody(rawText)
  const responseBodyDetail = responseBodySummary || "<empty>"

  const parsed = parseMessageMediaResponse(rawText)
  if (!parsed) {
    throw new MessageMediaSendError(
      `MessageMedia returned a non-JSON response; response body: ${responseBodyDetail}`,
      {
        httpStatus: response.status,
        responseBody: responseBodySummary,
      },
    )
  }

  const message = parsed.messages?.[0]
  const messageId = message?.message_id?.trim() ?? ""
  const status = message?.status?.trim() ?? "unknown"

  console.info(
    `[messagemedia sms] send response http=${response.status} message_id=${messageId || "n/a"} status=${status}`,
  )

  if (response.status !== 202) {
    throw new MessageMediaSendError(
      `MessageMedia HTTP ${response.status}; response body: ${responseBodyDetail}`,
      {
        httpStatus: response.status,
        responseBody: responseBodySummary,
      },
    )
  }

  if (!messageId) {
    throw new MessageMediaSendError(
      `MessageMedia response missing message_id; response body: ${responseBodyDetail}`,
      {
        httpStatus: response.status,
        responseBody: responseBodySummary,
      },
    )
  }

  return {
    message_id: messageId,
    status,
  }
}
