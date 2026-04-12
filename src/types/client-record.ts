export type TimelineNote = {
  id: string
  noteType: string
  text: string
  createdAt: string
}

export type ClientDetail = {
  id: string
  displayName: string
  partyType: string
  status: string
  updatedAt: string
  person: {
    legalGivenName: string
    legalFamilyName: string
    preferredName: string | null
    dateOfBirth: string | null
    mobilePhone: string | null
    emailPrimary: string | null
    relationshipStatus: string | null
    countryOfResidence: string | null
    preferredContactMethod: string | null
  } | null
  contactMethods: {
    id: string
    channel: string
    value: string
    isPrimary: boolean
  }[]
}