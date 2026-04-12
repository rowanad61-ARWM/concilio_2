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

export type HouseholdListItem = {
  id: string
  displayName: string
  isHousehold: boolean
  members: {
    id: string
    displayName: string
    role: string
  }[]
  status: string
  updatedAt: string
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
  householdName: string | null
}
