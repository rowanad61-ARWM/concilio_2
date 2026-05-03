import "server-only"

import type { SpeakerSegment, TranscriptionResult } from "@/types/transcription"

// Required environment variables:
// Preferred: AZURE_SPEECH_AU_ENDPOINT, AZURE_SPEECH_AU_KEY, AZURE_SPEECH_AU_REGION.
// Fallback for one deploy cycle: AZURE_SPEECH_ENDPOINT, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION.
const DEFAULT_API_VERSION = "v3.2-preview.2"
const DEFAULT_POLL_INTERVAL_MS = 10_000
const DEFAULT_POLL_TIMEOUT_MS = 8 * 60 * 1000

type AzureTranscriptionStatus = {
  self?: string
  status?: string
  links?: {
    files?: string
  }
  properties?: {
    duration?: string
  }
}

type AzureFilesResponse = {
  values?: AzureTranscriptionFile[]
  value?: AzureTranscriptionFile[]
}

type AzureTranscriptionFile = {
  kind?: string
  name?: string
  links?: {
    contentUrl?: string
  }
}

type AzureResultPhrase = {
  speaker?: number | string
  offsetInTicks?: number
  durationInTicks?: number
  nBest?: Array<{
    display?: string
  }>
  display?: string
}

type AzureTranscriptionJson = {
  combinedRecognizedPhrases?: Array<{
    display?: string
  }>
  recognizedPhrases?: AzureResultPhrase[]
}

export type SubmitTranscriptionOptions = {
  displayName?: string
  minSpeakerCount?: number
  maxSpeakerCount?: number
}

const useAuRegion = !!process.env.AZURE_SPEECH_AU_ENDPOINT?.trim()
const activeAzureSpeechRegion = useAuRegion ? "australiaeast" : "eastus"
const azureSpeechEndpointEnv = useAuRegion ? "AZURE_SPEECH_AU_ENDPOINT" : "AZURE_SPEECH_ENDPOINT"
const azureSpeechKeyEnv = useAuRegion ? "AZURE_SPEECH_AU_KEY" : "AZURE_SPEECH_KEY"

console.log("[azureSpeech] region: " + activeAzureSpeechRegion)

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function getSpeechEndpoint() {
  return getRequiredEnv(azureSpeechEndpointEnv).replace(/\/+$/, "")
}

function getSpeechKey() {
  return getRequiredEnv(azureSpeechKeyEnv)
}

function getApiVersion() {
  return process.env.AZURE_SPEECH_API_VERSION?.trim() || DEFAULT_API_VERSION
}

function transcriptionUrl(jobId?: string) {
  const base = `${getSpeechEndpoint()}/speechtotext/${getApiVersion()}/transcriptions`
  return jobId ? `${base}/${encodeURIComponent(jobId)}` : base
}

function jobIdFromSelf(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "")
  return trimmed.slice(trimmed.lastIndexOf("/") + 1)
}

async function speechFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Ocp-Apim-Subscription-Key": getSpeechKey(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Azure Speech request failed (${response.status}): ${text.slice(0, 500)}`)
  }

  return response
}

function ticksToSeconds(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value / 10_000_000 : 0
}

function parseIsoDurationSeconds(value: string | undefined) {
  if (!value) {
    return null
  }

  const match = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(value)
  if (!match) {
    return null
  }

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

function phraseText(phrase: AzureResultPhrase) {
  return phrase.nBest?.find((candidate) => candidate.display)?.display ?? phrase.display ?? ""
}

function parseSpeakerId(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/^speaker/i, ""))
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 1
}

function parseTranscriptionJson(payload: AzureTranscriptionJson, fallbackDuration: number | null): TranscriptionResult {
  const phrases = Array.isArray(payload.recognizedPhrases) ? payload.recognizedPhrases : []
  const speaker_segments: SpeakerSegment[] = phrases
    .map((phrase) => {
      const start = ticksToSeconds(phrase.offsetInTicks)
      const duration = ticksToSeconds(phrase.durationInTicks)
      return {
        speaker_id: parseSpeakerId(phrase.speaker),
        start,
        end: start + duration,
        text: phraseText(phrase).trim(),
      }
    })
    .filter((segment) => segment.text)

  const combinedText = Array.isArray(payload.combinedRecognizedPhrases)
    ? payload.combinedRecognizedPhrases.map((phrase) => phrase.display).filter(Boolean).join("\n").trim()
    : ""
  const text = combinedText || speaker_segments.map((segment) => segment.text).join("\n").trim()
  const derivedDuration = speaker_segments.length
    ? Math.max(...speaker_segments.map((segment) => segment.end))
    : null

  return {
    text,
    speaker_segments,
    duration_seconds: derivedDuration ?? fallbackDuration,
  }
}

async function loadTranscriptionJson(filesUrl: string, fallbackDuration: number | null) {
  const filesResponse = await speechFetch(filesUrl)
  const files = (await filesResponse.json()) as AzureFilesResponse
  const values = Array.isArray(files.values) ? files.values : Array.isArray(files.value) ? files.value : []
  const transcriptionFile = values.find((file) => file.kind === "Transcription")
    ?? values.find((file) => file.links?.contentUrl && file.name?.toLowerCase().endsWith(".json"))
    ?? values.find((file) => file.links?.contentUrl)

  const contentUrl = transcriptionFile?.links?.contentUrl
  if (!contentUrl) {
    throw new Error("Azure Speech transcription completed without a result contentUrl")
  }

  const resultResponse = await fetch(contentUrl)
  if (!resultResponse.ok) {
    const text = await resultResponse.text()
    throw new Error(`Azure Speech result download failed (${resultResponse.status}): ${text.slice(0, 500)}`)
  }

  return parseTranscriptionJson(await resultResponse.json() as AzureTranscriptionJson, fallbackDuration)
}

export async function submitTranscriptionJob(
  recordingUrl: string,
  options: SubmitTranscriptionOptions = {},
): Promise<{ jobId: string }> {
  if (!/^https:\/\//i.test(recordingUrl)) {
    throw new Error("Azure Speech batch transcription requires a directly reachable HTTPS recording URL")
  }

  const response = await speechFetch(transcriptionUrl(), {
    method: "POST",
    body: JSON.stringify({
      contentUrls: [recordingUrl],
      locale: "en-AU",
      displayName: options.displayName ?? `Concilio recording ${new Date().toISOString()}`,
      properties: {
        diarizationEnabled: true,
        displayFormWordLevelTimestampsEnabled: false,
        wordLevelTimestampsEnabled: false,
        punctuationMode: "DictatedAndAutomatic",
        profanityFilterMode: "Masked",
        timeToLiveHours: 48,
        diarization: {
          speakers: {
            minCount: options.minSpeakerCount ?? 1,
            maxCount: options.maxSpeakerCount ?? 8,
          },
        },
      },
    }),
  })

  const location = response.headers.get("location")
  const payload = await response.json() as AzureTranscriptionStatus
  const self = payload.self ?? location
  if (!self) {
    throw new Error("Azure Speech did not return a transcription job location")
  }

  return { jobId: jobIdFromSelf(self) }
}

export async function getTranscriptionResult(jobId: string): Promise<TranscriptionResult | null> {
  const response = await speechFetch(transcriptionUrl(jobId))
  const status = await response.json() as AzureTranscriptionStatus
  const normalizedStatus = status.status?.toLowerCase()

  if (normalizedStatus === "failed") {
    throw new Error("Azure Speech transcription job failed")
  }

  if (normalizedStatus !== "succeeded") {
    return null
  }

  if (!status.links?.files) {
    throw new Error("Azure Speech transcription succeeded without a files link")
  }

  return loadTranscriptionJson(status.links.files, parseIsoDurationSeconds(status.properties?.duration))
}

export async function waitForTranscriptionResult(
  jobId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? Number(process.env.AZURE_SPEECH_POLL_TIMEOUT_MS ?? DEFAULT_POLL_TIMEOUT_MS)
  const pollIntervalMs = options.pollIntervalMs ?? Number(process.env.AZURE_SPEECH_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS)
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const result = await getTranscriptionResult(jobId)
    if (result) {
      return result
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`Azure Speech transcription timed out after ${Math.round(timeoutMs / 1000)} seconds`)
}

export async function cancelTranscriptionJob(jobId: string): Promise<void> {
  await speechFetch(transcriptionUrl(jobId), { method: "DELETE" })
}
