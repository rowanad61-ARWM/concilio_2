export type ClientListItem = {
  id: string
  fullName: string
  partyType: string
  status: string
  updatedAt: string
  householdName: string | null
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
}
