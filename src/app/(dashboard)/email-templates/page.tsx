import EmailTemplatesList from "@/components/email-templates/EmailTemplatesList"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function EmailTemplatesPage() {
  const [templates, clients] = await Promise.all([
    db.emailTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    db.party.findMany({
      where: {
        party_type: "person",
        archived_at: null,
      },
      include: {
        person: true,
      },
      orderBy: {
        display_name: "asc",
      },
      take: 500,
    }),
  ])

  const clientOptions = clients.map((client) => {
    const first = client.person?.preferred_name || client.person?.legal_given_name || ""
    const last = client.person?.legal_family_name || ""
    const displayName = `${first} ${last}`.trim() || client.display_name

    return {
      id: client.id,
      displayName,
    }
  })

  return (
    <EmailTemplatesList
      templates={templates.map((template) => ({
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      }))}
      clients={clientOptions}
    />
  )
}

