import "server-only"

import { buildFileNoteMessages, FILE_NOTE_PROMPT_VERSION } from "@/lib/file-note-prompt"
import {
  buildFactExtractionMessages,
  FACT_EXTRACTION_PROMPT_VERSION,
} from "@/lib/fact-extraction-prompt"
import {
  buildTaskExtractionMessages,
  TASK_EXTRACTION_PROMPT_VERSION,
  type TaskSubtypePromptOption,
  type TaskTypePromptOption,
} from "@/lib/task-extraction-prompt"
import type { ExtractableFact, ParkOnlyCategory } from "@/lib/extractable-facts"

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

type ExtractTasksInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  taskTypeOptions: TaskTypePromptOption[]
  taskSubtypeOptions: TaskSubtypePromptOption[]
}

type ExtractFactsInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  extractableFacts: ExtractableFact[]
  parkOnlyCategories: ParkOnlyCategory[]
  currentValues: Record<string, unknown>
}

export type ExtractedTaskCandidate = {
  text: string
  owner_guess: "us" | "client"
  task_type_guess: string | null
  task_subtype_guess: string | null
  due_date_guess: string | null
  source_quote: string | null
}

export type ExtractedFactCandidate = {
  summary: string
  source_quote: string
  category: string
  proposed_action: "update" | "park" | "drop"
  proposed_target: {
    table: string
    column: string
    party_scope: "primary" | "household"
  } | null
  proposed_value: string | number | boolean | null
  current_value: string | number | boolean | null
  confidence: "high" | "medium" | "low"
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

type AzureChatRequestOptions = {
  messages: ChatCompletionMessageParam[]
  temperature: number
  maxTokens: number
  responseFormat?: { type: "json_object" }
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

const useAuRegion = !!process.env.AZURE_OPENAI_AU_ENDPOINT?.trim()
const activeAzureOpenAIRegion = useAuRegion ? "australiaeast" : "eastus"
const azureOpenAIEndpointEnv = useAuRegion ? "AZURE_OPENAI_AU_ENDPOINT" : "AZURE_OPENAI_ENDPOINT"
const azureOpenAIApiKeyEnv = useAuRegion ? "AZURE_OPENAI_AU_KEY" : "AZURE_OPENAI_KEY"
const azureOpenAIDeploymentEnv = useAuRegion ? "AZURE_OPENAI_AU_DEPLOYMENT" : "AZURE_OPENAI_DEPLOYMENT"
const azureOpenAIApiVersionEnv = useAuRegion ? "AZURE_OPENAI_AU_API_VERSION" : "AZURE_OPENAI_API_VERSION"

console.log("[azureOpenAI] region: " + activeAzureOpenAIRegion)

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function getEndpoint() {
  return getRequiredEnv(azureOpenAIEndpointEnv).replace(/\/+$/, "")
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

async function requestChatCompletion({ messages, temperature, maxTokens, responseFormat }: AzureChatRequestOptions) {
  const endpoint = getEndpoint()
  const deployment = getRequiredEnv(azureOpenAIDeploymentEnv)
  const apiVersion = getRequiredEnv(azureOpenAIApiVersionEnv)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "api-key": getRequiredEnv(azureOpenAIApiKeyEnv),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      },
    )

    const payloadText = await response.text()
    if (!response.ok) {
      throw new Error(classifyAzureOpenAIError(response.status, payloadText))
    }

    const payload = JSON.parse(payloadText) as AzureChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("Azure OpenAI returned an empty response")
    }

    const finishReason = payload.choices?.[0]?.finish_reason
    if (finishReason === "content_filter") {
      throw new Error("Azure OpenAI content filter blocked the response")
    }

    return {
      content,
      model: payload.model || deployment,
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

export async function generateFileNoteDraft({
  transcriptText,
  speakerNameMap,
  clientName,
  engagementMeta,
}: GenerateFileNoteDraftInput) {
  const response = await requestChatCompletion({
    messages: buildFileNoteMessages({
      transcriptText,
      speakerNameMap,
      clientName,
      engagementMeta,
    }),
    temperature: 0.4,
    maxTokens: 1500,
  })

  return {
    draftContent: response.content,
    model: response.model,
    promptVersion: FILE_NOTE_PROMPT_VERSION,
    generatedAt: new Date(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    throw new Error("Azure OpenAI task extraction returned a non-string nullable field")
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function dueDateString(value: unknown) {
  const trimmed = nullableString(value)
  if (!trimmed) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Azure OpenAI task extraction returned invalid due_date_guess: ${trimmed}`)
  }

  return trimmed
}

function validateExtractedTask(value: unknown, index: number): ExtractedTaskCandidate {
  if (!isRecord(value)) {
    throw new Error(`Azure OpenAI task extraction task ${index + 1} was not an object`)
  }

  const text = nullableString(value.text)
  if (!text) {
    throw new Error(`Azure OpenAI task extraction task ${index + 1} missing text`)
  }

  const ownerGuess = nullableString(value.owner_guess)
  if (ownerGuess !== "us" && ownerGuess !== "client") {
    throw new Error(`Azure OpenAI task extraction task ${index + 1} has invalid owner_guess`)
  }

  return {
    text,
    owner_guess: ownerGuess,
    task_type_guess: nullableString(value.task_type_guess),
    task_subtype_guess: nullableString(value.task_subtype_guess),
    due_date_guess: dueDateString(value.due_date_guess),
    source_quote: nullableString(value.source_quote),
  }
}

function parseTaskExtractionResponse(content: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(`Azure OpenAI task extraction returned invalid JSON: ${error instanceof Error ? error.message : "parse error"}`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) {
    throw new Error("Azure OpenAI task extraction response must be JSON object with a tasks array")
  }

  return parsed.tasks.map((task, index) => validateExtractedTask(task, index))
}

function jsonScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  throw new Error("Azure OpenAI fact extraction returned a non-scalar value")
}

function validateExtractedFact(
  value: unknown,
  index: number,
  extractableFacts: ExtractableFact[],
): ExtractedFactCandidate {
  if (!isRecord(value)) {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} was not an object`)
  }

  const summary = nullableString(value.summary)
  if (!summary) {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} missing summary`)
  }

  const sourceQuote = nullableString(value.source_quote)
  if (!sourceQuote) {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} missing source_quote`)
  }

  const category = nullableString(value.category)
  if (!category) {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} missing category`)
  }

  const proposedAction = nullableString(value.proposed_action)
  if (proposedAction !== "update" && proposedAction !== "park" && proposedAction !== "drop") {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} has invalid proposed_action`)
  }

  const confidence = nullableString(value.confidence)
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") {
    throw new Error(`Azure OpenAI fact extraction fact ${index + 1} has invalid confidence`)
  }

  let proposedTarget: ExtractedFactCandidate["proposed_target"] = null
  if (proposedAction === "update") {
    if (!isRecord(value.proposed_target)) {
      throw new Error(`Azure OpenAI fact extraction fact ${index + 1} update missing proposed_target`)
    }

    const table = nullableString(value.proposed_target.table)
    const column = nullableString(value.proposed_target.column)
    const partyScope = nullableString(value.proposed_target.party_scope)
    if (!table || !column || (partyScope !== "primary" && partyScope !== "household")) {
      throw new Error(`Azure OpenAI fact extraction fact ${index + 1} has invalid proposed_target`)
    }

    const targetExists = extractableFacts.some(
      (fact) => fact.table === table && fact.column === column && fact.party_scope === partyScope,
    )
    if (!targetExists) {
      throw new Error(`Azure OpenAI fact extraction fact ${index + 1} proposed unknown target ${table}.${column}`)
    }

    proposedTarget = {
      table,
      column,
      party_scope: partyScope,
    }
  }

  return {
    summary,
    source_quote: sourceQuote,
    category,
    proposed_action: proposedAction,
    proposed_target: proposedTarget,
    proposed_value: proposedAction === "update" ? jsonScalar(value.proposed_value) : null,
    current_value: jsonScalar(value.current_value),
    confidence,
  }
}

function parseFactExtractionResponse(content: string, extractableFacts: ExtractableFact[]) {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(`Azure OpenAI fact extraction returned invalid JSON: ${error instanceof Error ? error.message : "parse error"}`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.facts)) {
    throw new Error("Azure OpenAI fact extraction response must be JSON object with a facts array")
  }

  return parsed.facts.map((fact, index) => validateExtractedFact(fact, index, extractableFacts))
}

function normalizeTaskGuesses(
  tasks: ExtractedTaskCandidate[],
  taskTypeOptions: TaskTypePromptOption[],
  taskSubtypeOptions: TaskSubtypePromptOption[],
) {
  const typeSet = new Set(taskTypeOptions.map((option) => option.type))
  const subtypeByType = new Map<string, Set<string>>()

  taskSubtypeOptions.forEach((option) => {
    const current = subtypeByType.get(option.type) ?? new Set<string>()
    current.add(option.subtype)
    subtypeByType.set(option.type, current)
  })

  return tasks.map((task) => {
    const taskType = task.task_type_guess && typeSet.has(task.task_type_guess) ? task.task_type_guess : null
    const allowedSubtypes = taskType ? subtypeByType.get(taskType) ?? new Set<string>() : new Set<string>()
    const rawSubtype = task.task_subtype_guess
    const subtypeCandidates = rawSubtype
      ? [
          rawSubtype,
          rawSubtype.includes(":") ? rawSubtype.split(":").pop()?.trim() ?? "" : "",
          rawSubtype.includes("/") ? rawSubtype.split("/").pop()?.trim() ?? "" : "",
        ].filter(Boolean)
      : []
    const taskSubtype = subtypeCandidates.find((candidate) => allowedSubtypes.has(candidate)) ?? null

    return {
      ...task,
      task_type_guess: taskType,
      task_subtype_guess: taskSubtype,
    }
  })
}

export async function extractFacts({
  transcriptText,
  speakerNameMap,
  clientName,
  extractableFacts,
  parkOnlyCategories,
  currentValues,
}: ExtractFactsInput) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await requestChatCompletion({
      messages: buildFactExtractionMessages({
        transcriptText,
        speakerNameMap,
        clientName,
        extractableFacts,
        parkOnlyCategories,
        currentValues,
      }),
      temperature: 0.2,
      maxTokens: 2000,
      responseFormat: { type: "json_object" },
    })

    try {
      return {
        facts: parseFactExtractionResponse(response.content, extractableFacts),
        model: response.model,
        promptVersion: FACT_EXTRACTION_PROMPT_VERSION,
        generatedAt: new Date(),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Azure OpenAI fact extraction returned malformed JSON")
      if (attempt === 2) {
        break
      }
    }
  }

  throw lastError ?? new Error("Azure OpenAI fact extraction failed")
}

export async function extractTasks({
  transcriptText,
  speakerNameMap,
  clientName,
  taskTypeOptions,
  taskSubtypeOptions,
}: ExtractTasksInput) {
  const response = await requestChatCompletion({
    messages: buildTaskExtractionMessages({
      transcriptText,
      speakerNameMap,
      clientName,
      taskTypeOptions,
      taskSubtypeOptions,
    }),
    temperature: 0.2,
    maxTokens: 1500,
    responseFormat: { type: "json_object" },
  })

  const tasks = normalizeTaskGuesses(
    parseTaskExtractionResponse(response.content),
    taskTypeOptions,
    taskSubtypeOptions,
  )

  return {
    tasks,
    model: response.model,
    promptVersion: TASK_EXTRACTION_PROMPT_VERSION,
    generatedAt: new Date(),
  }
}
