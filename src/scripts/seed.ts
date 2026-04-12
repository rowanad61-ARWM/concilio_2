import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function loadDatabaseUrl() {
  const envLocalPath = resolve(process.cwd(), ".env.local")
  const envLocal = readFileSync(envLocalPath, "utf8")
  const databaseUrlLine = envLocal
    .split(/\r?\n/)
    .find((line) => line.startsWith("DATABASE_URL="))

  if (!databaseUrlLine) {
    throw new Error("DATABASE_URL not found in .env.local")
  }

  return databaseUrlLine.slice("DATABASE_URL=".length)
}

function createPrismaClient() {
  const connectionString = loadDatabaseUrl()
  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({ adapter })
}

async function main() {
  const prisma = createPrismaClient()

  console.log("Creating household: Mitchell Household")
  const household = await prisma.household_group.create({
    data: {
      household_name: "Mitchell Household",
      servicing_status: "active",
    },
  })

  console.log("Creating person: Sarah Mitchell")
  const sarahParty = await prisma.party.create({
    data: {
      display_name: "Sarah Mitchell",
      party_type: "person",
      status: "active",
    },
  })

  await prisma.person.create({
    data: {
      id: sarahParty.id,
      legal_given_name: "Sarah",
      legal_family_name: "Mitchell",
      preferred_name: "Sarah",
      date_of_birth: new Date("1978-03-14"),
      email_primary: "sarah@mitchells.com.au",
      mobile_phone: "0412 345 678",
      relationship_status: "married",
      country_of_residence: "AU",
      preferred_contact_method: "email",
      citizenships: [],
    },
  })

  console.log("Linking Sarah Mitchell to household as primary")
  await prisma.household_member.create({
    data: {
      household_id: household.id,
      party_id: sarahParty.id,
      role_in_household: "primary",
    },
  })

  console.log("Creating person: James Mitchell")
  const jamesParty = await prisma.party.create({
    data: {
      display_name: "James Mitchell",
      party_type: "person",
      status: "active",
    },
  })

  await prisma.person.create({
    data: {
      id: jamesParty.id,
      legal_given_name: "James",
      legal_family_name: "Mitchell",
      preferred_name: "James",
      date_of_birth: new Date("1976-07-22"),
      email_primary: "james@mitchells.com.au",
      mobile_phone: "0412 345 679",
      relationship_status: "married",
      country_of_residence: "AU",
      preferred_contact_method: "email",
      citizenships: [],
    },
  })

  console.log("Linking James Mitchell to household as spouse")
  await prisma.household_member.create({
    data: {
      household_id: household.id,
      party_id: jamesParty.id,
      role_in_household: "spouse",
    },
  })

  await prisma.$disconnect()
  console.log("Seed complete")
  process.exit(0)
}

void main().catch(async (error) => {
  console.error("Seed failed", error)
  process.exit(1)
})
