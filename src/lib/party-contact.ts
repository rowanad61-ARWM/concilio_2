type PartyPersonLike = {
  email_primary?: string | null
  mobile_phone?: string | null
  preferred_contact_method?: string | null
} | null

type PartyContactMethodLike = {
  channel?: string | null
  value?: string | null
  preferred_flag?: boolean | null
  do_not_use_flag?: boolean | null
  created_at?: Date | null
}

type PartyWithContactLike = {
  person?: PartyPersonLike
  contact_method?: PartyContactMethodLike[] | null
}

function toNonEmptyString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function isAllowedContactMethod(method: PartyContactMethodLike) {
  return method.do_not_use_flag !== true
}

function channelRankForMobile(channel: string) {
  if (channel === "mobile") {
    return 0
  }

  if (channel === "phone") {
    return 1
  }

  return 2
}

function sortByPreferredThenCreatedAt(left: PartyContactMethodLike, right: PartyContactMethodLike) {
  const leftPreferred = left.preferred_flag === true ? 1 : 0
  const rightPreferred = right.preferred_flag === true ? 1 : 0
  if (leftPreferred !== rightPreferred) {
    return rightPreferred - leftPreferred
  }

  const leftCreated = left.created_at ? left.created_at.getTime() : Number.MAX_SAFE_INTEGER
  const rightCreated = right.created_at ? right.created_at.getTime() : Number.MAX_SAFE_INTEGER
  return leftCreated - rightCreated
}

export function resolveEmailForParty(party: PartyWithContactLike): string | null {
  const personEmail = toNonEmptyString(party.person?.email_primary)
  if (personEmail) {
    return personEmail
  }

  const candidates = (party.contact_method ?? [])
    .filter((method) => {
      if (!isAllowedContactMethod(method)) {
        return false
      }

      return (method.channel ?? "").trim().toLowerCase() === "email"
    })
    .sort(sortByPreferredThenCreatedAt)

  return toNonEmptyString(candidates[0]?.value)
}

export function resolveMobileForParty(party: PartyWithContactLike): string | null {
  const personMobile = toNonEmptyString(party.person?.mobile_phone)
  if (personMobile) {
    return personMobile
  }

  const candidates = (party.contact_method ?? [])
    .filter((method) => {
      if (!isAllowedContactMethod(method)) {
        return false
      }

      const channel = (method.channel ?? "").trim().toLowerCase()
      return channel === "mobile" || channel === "phone"
    })
    .sort((left, right) => {
      const leftChannel = (left.channel ?? "").trim().toLowerCase()
      const rightChannel = (right.channel ?? "").trim().toLowerCase()
      const leftRank = channelRankForMobile(leftChannel)
      const rightRank = channelRankForMobile(rightChannel)
      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }

      return sortByPreferredThenCreatedAt(left, right)
    })

  return toNonEmptyString(candidates[0]?.value)
}

export function resolvePreferredContactMethodForParty(party: PartyWithContactLike): string | null {
  const personPreferred = toNonEmptyString(party.person?.preferred_contact_method)
  if (personPreferred) {
    return personPreferred
  }

  const preferredMethod = (party.contact_method ?? [])
    .filter((method) => isAllowedContactMethod(method) && method.preferred_flag === true)
    .sort(sortByPreferredThenCreatedAt)[0]

  const channel = toNonEmptyString(preferredMethod?.channel)
  return channel ? channel.toLowerCase() : null
}
