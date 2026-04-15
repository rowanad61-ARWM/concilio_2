import { db } from "./db"

type SeedTemplate = {
  name: string
  category: string
  subject: string
  body: string
}

const templates: SeedTemplate[] = [
  {
    name: "SOA Cover Letter",
    category: "SOA",
    subject: "Statement of Advice for {{client.fullName}}",
    body: `<p>Dear {{client.firstName}},</p>
<p>Please find attached your Statement of Advice prepared for your review.</p>
<p>If you have any questions, please reply to this email or call us on {{adviser.email}}.</p>
<p>Kind regards,<br />{{adviser.name}}</p>`,
  },
  {
    name: "ROA Cover Letter",
    category: "ROA",
    subject: "Record of Advice for {{client.fullName}}",
    body: `<p>Hi {{client.firstName}},</p>
<p>Your Record of Advice is now ready and attached for your records.</p>
<p>Please let us know if you would like to discuss any part of it.</p>
<p>Regards,<br />{{adviser.name}}</p>`,
  },
  {
    name: "Appointment Confirmation",
    category: "Appointment",
    subject: "Appointment confirmed for {{client.fullName}}",
    body: `<p>Hi {{client.firstName}},</p>
<p>This is a confirmation of your upcoming appointment with our team.</p>
<p>Date prepared: {{date.today}}</p>
<p>We look forward to meeting with you.</p>`,
  },
  {
    name: "Annual Review Invitation",
    category: "Annual Review",
    subject: "Time to schedule your {{date.year}} annual review",
    body: `<p>Dear {{client.firstName}},</p>
<p>It's time for your annual review. We'd love to book a suitable time with you.</p>
<p>Please reply to this email or contact {{adviser.email}}.</p>
<p>Kind regards,<br />{{adviser.name}}</p>`,
  },
]

async function seedTemplates() {
  let createdCount = 0
  let updatedCount = 0

  for (const template of templates) {
    const existing = await db.emailTemplate.findFirst({
      where: {
        name: template.name,
      },
    })

    if (existing) {
      await db.emailTemplate.update({
        where: { id: existing.id },
        data: {
          category: template.category,
          subject: template.subject,
          body: template.body,
          isActive: true,
        },
      })
      updatedCount += 1
    } else {
      await db.emailTemplate.create({
        data: template,
      })
      createdCount += 1
    }
  }

  console.log(`Seed complete. Created: ${createdCount}, Updated: ${updatedCount}`)
}

seedTemplates()
  .catch((error) => {
    console.error("Failed to seed templates", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })




