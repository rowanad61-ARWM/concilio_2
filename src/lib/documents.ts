export const CLIENT_DOCUMENT_FOLDERS = [
  "ID",
  "Super",
  "Insurance",
  "Banking",
  "SOA",
  "ROA",
  "Estate Planning",
  "Investments",
  "Centrelink",
  "Tax and Accountant",
  "Meetings",
  "Annual Review",
  "Legal",
  "Other",
] as const

export type ClientDocumentFolder = (typeof CLIENT_DOCUMENT_FOLDERS)[number]

export function normalizeClientDocumentFolder(input: string): ClientDocumentFolder | null {
  const normalized = input.trim()
  return CLIENT_DOCUMENT_FOLDERS.find((folder) => folder === normalized) ?? null
}
