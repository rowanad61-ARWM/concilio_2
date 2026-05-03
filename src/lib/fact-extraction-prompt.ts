import type { ChatCompletionMessageParam } from "@/lib/azureOpenAI"
import type { ExtractableFact, ParkOnlyCategory } from "@/lib/extractable-facts"

export const FACT_EXTRACTION_PROMPT_VERSION = "v1"

type BuildFactExtractionMessagesInput = {
  transcriptText: string
  speakerNameMap: Record<string, string>
  clientName: string | null
  extractableFacts: ExtractableFact[]
  parkOnlyCategories: ParkOnlyCategory[]
  currentValues: Record<string, unknown>
}

const SYSTEM_PROMPT = `You are a financial planning assistant extracting structured facts from a client meeting transcript. Your job is to identify factual statements about the client (and their household) that are worth recording in the firm's records, and to classify each one against the firm's data model.

For each fact you identify:
- summary: a short, adviser-readable description of the fact
- source_quote: a verbatim snippet from the transcript that contains the fact
- category: a category name from the supplied list (covered categories) or from the park-only categories list
- proposed_action: 'update' if the fact maps to a covered (table, column) AND is concrete enough to write; 'park' if the fact is real and worth keeping but the category is park-only OR no specific column matches; 'drop' if the fact is too vague, hypothetical, or noise to be worth recording
- proposed_target: { table, column, party_scope } if proposed_action is 'update', else null
- proposed_value: the value to write if 'update', formatted appropriately for the column type (ISO date for dates, plain text otherwise); null if 'park' or 'drop'
- current_value: the existing value already on the column if any (will be supplied to you); for 'update' actions where current_value differs from proposed_value, this is a conflict that the adviser will resolve
- confidence: 'high' | 'medium' | 'low' - your confidence the extraction is correct and grounded in the transcript

Do not invent facts. Do not extrapolate. If the client mentions something in passing without committing detail (e.g. 'I have some super somewhere'), drop or park rather than fabricating numbers.

Return strictly valid JSON of shape: { facts: [...] }. Empty array if nothing extractable surfaced. No prose outside the JSON.`

function speakerLabel(id: string) {
  return /^speaker\s+\d+$/i.test(id) ? id : `Speaker ${id}`
}

function renderNamedTranscript(transcriptText: string, speakerNameMap: Record<string, string>) {
  return transcriptText
    .split("\n")
    .map((line) => {
      const match = line.match(/^Speaker\s+(\d+):\s*(.*)$/i)
      if (!match) {
        return line
      }

      const speakerId = match[1]
      const mappedName = speakerNameMap[speakerId]?.trim()
      return `${mappedName || speakerLabel(speakerId)}: ${match[2]}`
    })
    .join("\n")
}

function formatExtractableFacts(facts: ExtractableFact[]) {
  return facts
    .map(
      (fact) =>
        `- ${fact.table}.${fact.column} [category=${fact.category}, scope=${fact.party_scope}, type=${fact.value_type}] - ${fact.description}`,
    )
    .join("\n")
}

function formatParkOnlyCategories(categories: ParkOnlyCategory[]) {
  return categories.map((category) => `- ${category.category} - ${category.description}`).join("\n")
}

export function buildFactExtractionMessages({
  transcriptText,
  speakerNameMap,
  clientName,
  extractableFacts,
  parkOnlyCategories,
  currentValues,
}: BuildFactExtractionMessagesInput): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        `Client: ${clientName ?? "Unknown client"}`,
        "",
        "Covered schema facts:",
        formatExtractableFacts(extractableFacts),
        "",
        "Park-only categories:",
        formatParkOnlyCategories(parkOnlyCategories),
        "",
        "Current Concilio values, keyed by table.column:",
        JSON.stringify(currentValues, null, 2),
        "",
        "Transcript:",
        renderNamedTranscript(transcriptText, speakerNameMap),
      ].join("\n"),
    },
  ]
}
