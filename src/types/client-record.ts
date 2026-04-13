export type TimelineNote = {
  id: string
  noteType: string
  text: string
  createdAt: string
}

export type ClientAddress = {
  line1: string | null
  line2: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  country: string | null
}

export type ClientDetail = {
  id: string
  displayName: string
  partyType: string
  status: string
  updatedAt: string
  household: {
    id: string
    name: string
    role: string
    members: {
      id: string
      displayName: string
      role: string
    }[]
  } | null
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
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
    addressResidential: ClientAddress | null
    addressPostal: ClientAddress | null
  } | null
  contactMethods: {
    id: string
    channel: string
    value: string
    isPrimary: boolean
  }[]
  verificationChecks: {
    id: string
    checkType: string
    documentType: string | null
    documentReference: string | null
    result: string
    verifiedAt: string | null
    expiryDate: string | null
    notes: string | null
  }[]
}
