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

export type ClientHouseholdMember = {
  id: string
  partyId: string
  displayName: string
  role: string
  endDate: string | null
  relation: string | null
  isFinancialDependant: boolean
  dependantUntilAge: number | null
  dependantNotes: string | null
  relationToMemberId: string | null
  dateOfBirth: string | null
  legalGivenName: string | null
  legalFamilyName: string | null
}

export type ProfessionalRelationship = {
  id: string
  relationshipType: string
  isAuthorised: boolean
  authorisationExpiry: string | null
  firstName: string | null
  surname: string | null
  company: string | null
  phone: string | null
  email: string | null
  addressLine: string | null
  addressSuburb: string | null
  addressState: string | null
  addressPostcode: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type EstateExecutor = {
  id: string
  entityType: string
  firstName: string | null
  surname: string | null
  preferredName: string | null
  notes: string | null
}

export type ClientDetail = {
  id: string
  displayName: string
  partyType: string
  status: string
  updatedAt: string
  resolvedEmail: string | null
  resolvedMobile: string | null
  resolvedPreferredContactMethod: string | null
  household: {
    id: string
    name: string
    salutationInformal: string | null
    addressTitleFormal: string | null
    householdNotes: string | null
    role: string
    members: ClientHouseholdMember[]
  } | null
  professionalRelationships: ProfessionalRelationship[]
  estateExecutors: EstateExecutor[]
  classification: {
    serviceTier: string | null
    lifecycleStage: string | null
  } | null
  person: {
    title: string | null
    legalGivenName: string
    legalMiddleNames: string | null
    legalFamilyName: string
    initials: string | null
    preferredName: string | null
    maidenName: string | null
    mothersMaidenName: string | null
    dateOfBirth: string | null
    gender: string | null
    genderPronouns: string | null
    placeOfBirth: string | null
    countryOfBirth: string | null
    mobilePhone: string | null
    emailPrimary: string | null
    emailAlternate: string | null
    relationshipStatus: string | null
    countryOfResidence: string | null
    residentStatus: string | null
    countryOfTaxResidency: string | null
    taxResidentStatus: string | null
    isPepRisk: boolean
    pepNotes: string | null
    willExists: boolean | null
    willIsCurrent: boolean | null
    willDate: string | null
    willLocation: string | null
    estatePlanningNotes: string | null
    funeralPlanStatus: string | null
    emergencyContactName: string | null
    emergencyContactRelationship: string | null
    emergencyContactPhone: string | null
    emergencyContactEmail: string | null
    emergencyContactNotes: string | null
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
