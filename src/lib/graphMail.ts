import "server-only"

import { ResponseType } from "@microsoft/microsoft-graph-client"

import { getGraphClient } from "@/lib/graph"

type GraphErrorShape = {
  body?: unknown
  message?: unknown
}

function getAdviserEmail() {
  const adviserEmail = process.env.ADVISER_EMAIL?.trim()
  if (!adviserEmail) {
    throw new Error("ADVISER_EMAIL is not configured")
  }

  return adviserEmail
}

function stringifyGraphError(error: unknown) {
  if (!error) {
    return "Unknown Graph error"
  }

  if (typeof error === "string") {
    return error
  }

  if (typeof error === "object") {
    const value = error as GraphErrorShape
    if (value.body !== undefined) {
      if (typeof value.body === "string") {
        return value.body
      }

      try {
        return JSON.stringify(value.body)
      } catch {
        return String(value.body)
      }
    }

    if (typeof value.message === "string") {
      return value.message
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(error)
}

function extractMessageIdFromLocation(location: string | null) {
  if (!location) {
    return ""
  }

  const match = location.match(/\/messages\/([^/?]+)/i)
  if (!match?.[1]) {
    return ""
  }

  return decodeURIComponent(match[1])
}

export async function sendMailAsAdviser(opts: {
  toEmail: string
  toName?: string
  subject: string
  htmlBody: string
  bodyContentType?: "HTML" | "Text"
}): Promise<{ messageId: string }> {
  const adviserEmail = getAdviserEmail()
  const graphClient = getGraphClient()

  try {
    const rawResponse = await graphClient
      .api(`/users/${encodeURIComponent(adviserEmail)}/sendMail`)
      .responseType(ResponseType.RAW)
      .post({
        message: {
          subject: opts.subject,
          body: {
            contentType: opts.bodyContentType ?? "HTML",
            content: opts.htmlBody,
          },
          toRecipients: [
            {
              emailAddress: {
                address: opts.toEmail,
                name: opts.toName || opts.toEmail,
              },
            },
          ],
        },
        saveToSentItems: true,
      })

    const locationHeader =
      rawResponse?.headers?.get?.("location") ??
      rawResponse?.headers?.get?.("Location") ??
      null
    const messageId = extractMessageIdFromLocation(locationHeader)

    if (!messageId) {
      console.warn("[graphMail] sendMail succeeded but Location header did not include message id")
    }

    return { messageId }
  } catch (error) {
    const graphError = stringifyGraphError(error)
    throw new Error(`Graph sendMail failed: ${graphError}`)
  }
}
