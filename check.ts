import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
p.engagement.findMany({
  orderBy: { created_at: "desc" },
  take: 5,
  select: { id: true, engagement_type: true, party_id: true, household_id: true, calendly_event_uuid: true, opened_at: true }
}).then(r => {
  console.log(JSON.stringify(r, null, 2))
  return p.$disconnect()
}).catch(e => {
  console.error(e)
  return p.$disconnect()
})
