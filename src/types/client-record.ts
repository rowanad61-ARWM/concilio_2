export type TimelineNote = {
  id: string
  noteType: string
  text: string
  createdAt: string
}

export type TimelineEngagement = {
  id: string
  engagementType: string
  title: string
  source?: string | null
  meetingTypeKey?: string | null
  openedAt?: string | null
  status: string
  startedAt: string
  workflowInstance: {
    id: string
    currentStage: string
    status: string
    stages: {
      key: string
      label: string
      order: number
    }[]
  } | null
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
  employment: {
    employmentStatus: string | null
    employerName: string | null
    occupation: string | null
    industry: string | null
    employmentType: string | null
  } | null
  riskProfile: {
    id: string
    riskResult: string
    score: number | null
    capacityForLoss: string | null
    overrideFlag: boolean
    overrideReason: string | null
    completedAt: string | null
    validUntil: string | null
  } | null
  engagements: TimelineEngagement[]
}
