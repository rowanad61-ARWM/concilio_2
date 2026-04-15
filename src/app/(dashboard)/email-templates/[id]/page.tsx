import { notFound } from "next/navigation"

import EmailTemplateEditor from "@/components/email-templates/EmailTemplateEditor"
import { db } from "@/lib/db"

type EmailTemplateEditorPageProps = {
  params: Promise<{ id: string }>
}

export default async function EmailTemplateEditorPage({ params }: EmailTemplateEditorPageProps) {
  const { id } = await params

  const template = await db.emailTemplate.findUnique({
    where: { id },
  })

  if (!template) {
    notFound()
  }

  return (
    <EmailTemplateEditor
      mode="edit"
      template={{
        id: template.id,
        name: template.name,
        category: template.category,
        subject: template.subject,
        body: template.body,
      }}
    />
  )
}

