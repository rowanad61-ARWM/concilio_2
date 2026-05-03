import type { ChatCompletionMessageParam } from "@/lib/azureOpenAI"

export const TASK_EXTRACTION_PROMPT_VERSION = "v1"

const SYSTEM_PROMPT = `You are a financial planning assistant extracting follow-up tasks from a meeting transcript. Your job is to surface concrete, actionable items that came up in the conversation and require someone to do something afterwards. Be conservative - extract only things genuinely committed to or required, not hypotheticals or things merely mentioned.

For each task, identify:
- text: a short clear description of what needs doing, written in the imperative ('Send statement of advice', not 'I will send the statement of advice')
- owner_guess: 'us' if the adviser or practice needs to do it; 'client' if the client needs to do it
- task_type_guess: the best match from the supplied task type list, or null if none fits
- task_subtype_guess: the best match from the supplied subtype list given the chosen type, or null
- due_date_guess: ISO date string if a specific deadline was committed to in the conversation; null otherwise (do not infer 'soon' or 'next week' as a date)
- source_quote: a short verbatim snippet from the transcript that grounds the task

Return strictly valid JSON of shape: { tasks: [...] }. Empty array if nothing actionable surfaced. No prose outside the JSON.`

export type TaskTypePromptOption = {
  type: string
}

export type TaskSubtypePromptOption = {
  type: string
  subtype: string
}

type BuildTaskExtractionMessagesInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  taskTypeOptions: TaskTypePromptOption[]
  taskSubtypeOptions: TaskSubtypePromptOption[]
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

function renderTypeOptions(options: TaskTypePromptOption[]) {
  if (options.length === 0) {
    return "- No configured task types."
  }

  return options.map((option) => `- ${option.type}`).join("\n")
}

function renderSubtypeOptions(options: TaskSubtypePromptOption[]) {
  if (options.length === 0) {
    return "- No configured task subtypes."
  }

  return options.map((option) => `- type: ${option.type}; subtype value: ${option.subtype}`).join("\n")
}

export function buildTaskExtractionMessages({
  transcriptText,
  speakerNameMap,
  clientName,
  taskTypeOptions,
  taskSubtypeOptions,
}: BuildTaskExtractionMessagesInput): ChatCompletionMessageParam[] {
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
        "Task type options:",
        renderTypeOptions(taskTypeOptions),
        "",
        "Task subtype options:",
        renderSubtypeOptions(taskSubtypeOptions),
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
