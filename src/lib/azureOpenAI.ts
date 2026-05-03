import "server-only"

import { buildFileNoteMessages, FILE_NOTE_PROMPT_VERSION } from "@/lib/file-note-prompt"

export type ChatCompletionMessageParam = {
  role: "system" | "user" | "assistant"
  content: string
}

type GenerateFileNoteDraftInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  engagementMeta?: Record<string, unknown> | null
}

type AzureOpenAIErrorResponse = {
  error?: {
    code?: string
    message?: string
    innererror?: {
      code?: string
    }
  }
}

type AzureChatCompletionResponse = {
  model?: string
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string
    }
  }>
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function getEndpoint() {
  return getRequiredEnv("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "")
}

function classifyAzureOpenAIError(status: number, payloadText: string) {
  let parsed: AzureOpenAIErrorResponse | null = null
  try {
    parsed = JSON.parse(payloadText) as AzureOpenAIErrorResponse
  } catch {
    parsed = null
  }

  const code = parsed?.error?.innererror?.code || parsed?.error?.code || ""
  const message = parsed?.error?.message || payloadText
  const lowerCode = code.toLowerCase()

  if (status === 401 || status === 403) {
    return `Azure OpenAI auth error: ${message}`
  }
  if (status === 429) {
    return `Azure OpenAI rate limit error: ${message}`
  }
  if (lowerCode.includes("content") || lowerCode.includes("responsibleai")) {
    return `Azure OpenAI content filter error: ${message}`
  }
  return `Azure OpenAI request failed (${status}): ${message}`
}

export async function generateFileNoteDraft({
  transcriptText,
  speakerNameMap,
  clientName,
  engagementMeta,
}: GenerateFileNoteDraftInput) {
  const endpoint = getEndpoint()
  const deployment = getRequiredEnv("AZURE_OPENAI_DEPLOYMENT")
  const apiVersion = getRequiredEnv("AZURE_OPENAI_API_VERSION")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "api-key": getRequiredEnv("AZURE_OPENAI_KEY"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: buildFileNoteMessages({
            transcriptText,
            speakerNameMap,
            clientName,
            engagementMeta,
          }),
          temperature: 0.4,
          max_tokens: 1500,
        }),
      },
    )

    const payloadText = await response.text()
    if (!response.ok) {
      throw new Error(classifyAzureOpenAIError(response.status, payloadText))
    }

    const payload = JSON.parse(payloadText) as AzureChatCompletionResponse
    const draftContent = payload.choices?.[0]?.message?.content?.trim()
    if (!draftContent) {
      throw new Error("Azure OpenAI returned an empty file note draft")
    }

    const finishReason = payload.choices?.[0]?.finish_reason
    if (finishReason === "content_filter") {
      throw new Error("Azure OpenAI content filter blocked the file note draft")
    }

    return {
      draftContent,
      model: payload.model || deployment,
      promptVersion: FILE_NOTE_PROMPT_VERSION,
      generatedAt: new Date(),
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Azure OpenAI request timed out after 60 seconds")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
