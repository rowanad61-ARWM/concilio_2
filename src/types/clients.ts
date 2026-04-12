export type ClientListItem = {
  id: string
  fullName: string
  partyType: string
  status: string
  updatedAt: string
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
}
