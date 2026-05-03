import type { ChatCompletionMessageParam } from "@/lib/azureOpenAI"

export const FILE_NOTE_PROMPT_VERSION = "v1"

const SYSTEM_PROMPT = `You are an experienced financial planning assistant writing a file note for the adviser team at a wealth management firm. Your job is to capture what the team should know about this client after this conversation - not to minute the meeting. The recording itself is the compliance artifact; this note is the practice's institutional memory of who the client is.

Write in flowing narrative prose. Use direct quotes only where they capture something a paraphrase would lose - a turn of phrase, a strong feeling, a specific number the client offered. Do not bullet-list. Aim for under a two-minute read.

Cover, in whatever order serves the conversation: who was in the room and the relational context, what came up, the reasoning behind any decisions or hesitations, anything the adviser should be sensitive to next time, and open threads or things deferred.

Use the named speakers given. If a speaker is unnamed, refer to them by their generic label. Do not invent. If the transcript is thin or the meeting was largely administrative, write a shorter note rather than padding.`

type BuildFileNoteMessagesInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  engagementMeta?: Record<string, unknown> | null
}

function speakerLabel(rawSpeakerId: string, speakerNameMap: Record<string, string>) {
  const cleaned = rawSpeakerId.trim()
  const numericId = cleaned.replace(/^speaker\s*/i, "")
  return speakerNameMap[cleaned] || speakerNameMap[numericId] || `Speaker ${numericId || cleaned}`
}

function renderTranscriptWithSpeakerNames(transcriptText: string, speakerNameMap: Record<string, string>) {
  return transcriptText
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^\s*(?:speaker\s*)?(\d+)\s*:\s*/i, (_match, speakerId: string) => {
        return `${speakerLabel(speakerId, speakerNameMap)}: `
      }),
    )
    .join("\n")
}

function renderEngagementMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta) {
    return "None provided."
  }

  const entries = Object.entries(meta).filter(([_key, value]) => value !== null && value !== undefined && value !== "")
  if (entries.length === 0) {
    return "None provided."
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join("\n")
}

export function buildFileNoteMessages({
  transcriptText,
  speakerNameMap,
  clientName,
  engagementMeta,
}: BuildFileNoteMessagesInput): ChatCompletionMessageParam[] {
  const namedTranscript = renderTranscriptWithSpeakerNames(transcriptText, speakerNameMap)

  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        `Client: ${clientName || "Unknown client"}`,
        "",
        "Engagement context:",
        renderEngagementMeta(engagementMeta),
        "",
        "Speaker name map:",
        JSON.stringify(speakerNameMap, null, 2),
        "",
        "Transcript:",
        namedTranscript,
      ].join("\n"),
    },
  ]
}
