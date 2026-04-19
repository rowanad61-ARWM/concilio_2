import { db } from "./db"

type SeedTaskTypeRow = {
  type: string
  subtype: string | null
  sortOrder: number
}

const seedRows: SeedTaskTypeRow[] = [
  { type: "Adhoc", subtype: null, sortOrder: 0 },
  { type: "Advice", subtype: "SOA", sortOrder: 10 },
  { type: "Advice", subtype: "ROA", sortOrder: 11 },
  { type: "CashFlow", subtype: "Budget Review", sortOrder: 20 },
  { type: "CashFlow", subtype: "Cashflow Forecast", sortOrder: 21 },
  { type: "Cash Transfer", subtype: "Inbound", sortOrder: 30 },
  { type: "Cash Transfer", subtype: "Outbound", sortOrder: 31 },
  { type: "Centrelink", subtype: "Pension Application", sortOrder: 40 },
  { type: "Centrelink", subtype: "Asset Update", sortOrder: 41 },
  { type: "CMA/XL Set Up", subtype: "New Account", sortOrder: 50 },
  { type: "CMA/XL Set Up", subtype: "Account Change", sortOrder: 51 },
  { type: "Legal", subtype: "POA", sortOrder: 60 },
  { type: "Legal", subtype: "Will Review", sortOrder: 61 },
  { type: "Tax and Accounting", subtype: "Tax Return", sortOrder: 70 },
  { type: "Tax and Accounting", subtype: "BAS", sortOrder: 71 },
  { type: "Investment", subtype: "Buy", sortOrder: 80 },
  { type: "Investment", subtype: "Sell", sortOrder: 81 },
  { type: "Investment", subtype: "Rebalance", sortOrder: 82 },
  { type: "Insurance", subtype: "New Policy", sortOrder: 90 },
  { type: "Insurance", subtype: "Claim", sortOrder: 91 },
  { type: "Insurance", subtype: "Review", sortOrder: 92 },
  { type: "Lending", subtype: "New Loan", sortOrder: 100 },
  { type: "Lending", subtype: "Refinance", sortOrder: 101 },
  { type: "Phone Call", subtype: null, sortOrder: 110 },
  { type: "Super/SMSF", subtype: "Contribution", sortOrder: 120 },
  { type: "Super/SMSF", subtype: "Pension Setup", sortOrder: 121 },
  { type: "Super/SMSF", subtype: "Rollover", sortOrder: 122 },
]

async function seedTaskTypes() {
  let upserted = 0

  for (const row of seedRows) {
    if (row.subtype === null) {
      const existing = await db.taskTypeOption.findFirst({
        where: {
          type: row.type,
          subtype: null,
        },
      })

      if (existing) {
        await db.taskTypeOption.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            sortOrder: row.sortOrder,
          },
        })
      } else {
        await db.taskTypeOption.create({
          data: {
            type: row.type,
            subtype: null,
            isActive: true,
            sortOrder: row.sortOrder,
          },
        })
      }
    } else {
      await db.taskTypeOption.upsert({
        where: {
          type_subtype: {
            type: row.type,
            subtype: row.subtype,
          },
        },
        create: {
          type: row.type,
          subtype: row.subtype,
          isActive: true,
          sortOrder: row.sortOrder,
        },
        update: {
          isActive: true,
          sortOrder: row.sortOrder,
        },
      })
    }

    upserted += 1
  }

  console.log(`Task type seed complete. Upserted: ${upserted}`)
}

seedTaskTypes()
  .catch((error) => {
    console.error("Failed to seed task types", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
