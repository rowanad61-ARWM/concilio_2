import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

function loadDatabaseUrl() {
  const fromEnvironment = process.env.DATABASE_URL?.trim()
  if (fromEnvironment) {
    return fromEnvironment
  }

  const envLocalPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envLocalPath)) {
    throw new Error("DATABASE_URL not set and .env.local not found")
  }

  const envLocal = readFileSync(envLocalPath, "utf8")
  const databaseUrlLine = envLocal
    .split(/\r?\n/)
    .find((line) => line.startsWith("DATABASE_URL="))

  if (!databaseUrlLine) {
    throw new Error("DATABASE_URL not found in .env.local")
  }

  return databaseUrlLine.slice("DATABASE_URL=".length)
}

const MEETING_TYPE_ROWS = [
  {
    meeting_type_key: "INITIAL_MEETING",
    display_name: "Initial Meeting",
    auto_create_prospect: true,
    unresolved_log_level: "info",
  },
  {
    meeting_type_key: "FIFTEEN_MIN_CALL",
    display_name: "15 Minute Call",
    auto_create_prospect: true,
    unresolved_log_level: "info",
  },
  {
    meeting_type_key: "GENERAL_MEETING",
    display_name: "General Meeting",
    auto_create_prospect: false,
    unresolved_log_level: "info",
  },
  {
    meeting_type_key: "ANNUAL_REVIEW",
    display_name: "Annual Review",
    auto_create_prospect: false,
    unresolved_log_level: "warn",
  },
  {
    meeting_type_key: "NINETY_DAY_RECAP",
    display_name: "90-Day Recap",
    auto_create_prospect: false,
    unresolved_log_level: "warn",
  },
] as const

async function main() {
  const adapter = new PrismaPg({ connectionString: loadDatabaseUrl() })
  const prisma = new PrismaClient({ adapter })

  try {
    for (const row of MEETING_TYPE_ROWS) {
      await prisma.calendly_event_type_map.upsert({
        where: {
          meeting_type_key: row.meeting_type_key,
        },
        update: {
          display_name: row.display_name,
          auto_create_prospect: row.auto_create_prospect,
          unresolved_log_level: row.unresolved_log_level,
          active: true,
        },
        create: {
          meeting_type_key: row.meeting_type_key,
          display_name: row.display_name,
          auto_create_prospect: row.auto_create_prospect,
          unresolved_log_level: row.unresolved_log_level,
          active: true,
          calendly_event_type_uri: null,
        },
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  console.error("[seed calendly map failed]", error)
  process.exit(1)
})
