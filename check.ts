import { PrismaClient } from "@prisma/client"
const p = new PrismaClient()
const partyId = "c0d48991-e185-47ce-b139-bef9b56826e4"
Promise.all([
  p.party.findUnique({ where: { id: partyId } }),
  p.person.findFirst({ where: { id: partyId } }),
  p.contact_method.findMany({ where: { party_id: partyId } }),
]).then(([party, person, cms]) => {
  console.log("PARTY:", JSON.stringify(party, null, 2))
  console.log("PERSON:", JSON.stringify(person, null, 2))
  console.log("CONTACT_METHOD:", JSON.stringify(cms, null, 2))
  return p.$disconnect()
}).catch(e => {
  console.error(e)
  return p.$disconnect()
})
