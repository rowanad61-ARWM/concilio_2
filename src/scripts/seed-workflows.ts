import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { Client } from "pg"

type WorkflowStage = {
  key: string
  label: string
  order: number
}

type WorkflowTemplateSeed = {
  name: string
  description: string
  stages: WorkflowStage[]
}

type ConstraintRow = {
  definition: string
}

const templates: WorkflowTemplateSeed[] = [
  {
    name: "New Client Onboarding",
    description: "Core onboarding workflow for new client engagements.",
    stages: [
      { key: "initial_meeting", label: "Initial Meeting", order: 1 },
      { key: "fact_find", label: "Fact Find", order: 2 },
      { key: "risk_profile", label: "Risk Profile", order: 3 },
      { key: "soa_preparation", label: "SOA Preparation", order: 4 },
      { key: "soa_presentation", label: "SOA Presentation", order: 5 },
      { key: "implementation", label: "Implementation", order: 6 },
      { key: "review_setup", label: "Review Setup", order: 7 },
    ],
  },
  {
    name: "Annual Review",
    description: "Standard annual review cycle workflow.",
    stages: [
      { key: "pre_review_prep", label: "Pre-Review Prep", order: 1 },
      { key: "client_meeting", label: "Client Meeting", order: 2 },
      { key: "roa_preparation", label: "ROA Preparation", order: 3 },
      { key: "implementation", label: "Implementation", order: 4 },
      { key: "complete", label: "Complete", order: 5 },
    ],
  },
  {
    name: "Statement of Advice",
    description: "SOA-only workflow for scoped advice engagements.",
    stages: [
      { key: "fact_find", label: "Fact Find", order: 1 },
      { key: "research", label: "Research", order: 2 },
      { key: "soa_preparation", label: "SOA Preparation", order: 3 },
      { key: "soa_presentation", label: "SOA Presentation", order: 4 },
      { key: "implementation", label: "Implementation", order: 5 },
    ],
  },
]

function getDatabaseUrl() {
  const envFilePath = resolve(process.cwd(), ".env.local")
  const envContents = readFileSync(envFilePath, "utf8")

  const databaseUrlLine = envContents
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("DATABASE_URL="))

  if (!databaseUrlLine) {
    throw new Error("DATABASE_URL not found in .env.local")
  }

  const value = databaseUrlLine.slice(databaseUrlLine.indexOf("=") + 1).trim()
  if (!value) {
    throw new Error("DATABASE_URL in .env.local is empty")
  }

  return value
}

function extractConstraintValues(definition: string) {
  const matches = definition.matchAll(/'([^']+)'/g)
  const values = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      values.add(match[1])
    }
  }

  return [...values]
}

async function determineTemplateStatus(client: Client) {
  const rows = await client.query<ConstraintRow>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'workflow_template'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%status%'`,
  )

  const options = rows.rows.flatMap((row) => extractConstraintValues(row.definition))

  if (options.includes("active")) {
    return "active"
  }

  if (options.includes("deployed")) {
    return "deployed"
  }

  return options[0] ?? "active"
}

async function main() {
  const databaseUrl = getDatabaseUrl()
  const parsedUrl = new URL(databaseUrl)

  const client = new Client({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
    database: parsedUrl.pathname.replace(/^\//, ""),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    ssl: {
      rejectUnauthorized: false,
    },
  })

  await client.connect()

  try {
    await client.query("BEGIN")

    const templateStatus = await determineTemplateStatus(client)
    const deployedAt = templateStatus === "active" || templateStatus === "deployed" ? new Date() : null

    for (const template of templates) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO workflow_template (name, version, description, stages, status, deployed_at)
         VALUES ($1, 1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (name, version)
         DO UPDATE SET
           description = EXCLUDED.description,
           stages = EXCLUDED.stages,
           status = EXCLUDED.status,
           deployed_at = EXCLUDED.deployed_at
         RETURNING id`,
        [
          template.name,
          template.description,
          JSON.stringify(template.stages),
          templateStatus,
          deployedAt,
        ],
      )

      console.log(`Seeded workflow template: ${template.name} (${result.rows[0]?.id ?? "unknown"})`)
    }

    await client.query("COMMIT")
    console.log("Workflow template seed complete")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    await client.end()
  }
}

void main().catch((error) => {
  console.error("Failed to seed workflow templates", error)
  process.exit(1)
})

