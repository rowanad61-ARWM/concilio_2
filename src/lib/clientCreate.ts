import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

type ClientCreateDb = Prisma.TransactionClient | typeof db

const UNKNOWN_DATE_OF_BIRTH = new Date("1900-01-01T00:00:00.000Z")

function clientFromTx(tx?: Prisma.TransactionClient): ClientCreateDb {
  return tx ?? db
}

export async function createPersonFromName(input: {
  party_id: string
  first_name: string
  last_name: string
  tx?: Prisma.TransactionClient
}): Promise<void> {
  const client = clientFromTx(input.tx)

  await client.person.create({
    data: {
      id: input.party_id,
      legal_given_name: input.first_name,
      legal_family_name: input.last_name,
      date_of_birth: UNKNOWN_DATE_OF_BIRTH,
      citizenships: [],
    },
  })
}

export async function createDefaultHousehold(input: {
  party_id: string
  last_name: string
  tx?: Prisma.TransactionClient
}): Promise<{ household_id: string }> {
  const client = clientFromTx(input.tx)
  const householdName = `${input.last_name.trim() || "Client"} Household`

  const household = await client.household_group.create({
    data: {
      household_name: householdName,
      servicing_status: "active",
    },
    select: {
      id: true,
    },
  })

  await client.household_member.create({
    data: {
      household_id: household.id,
      party_id: input.party_id,
      role_in_household: "primary",
    },
  })

  return { household_id: household.id }
}
