import { NextResponse } from "next/server"

import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"
import {
  emailTemplateRouteId,
  loadEmailTemplateSnapshot,
  responseEmailTemplateId,
  type EmailTemplateRouteContext,
} from "@/lib/email-audit-snapshots"

function parseTemplateUpdate(payload: Record<string, unknown>) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : ""
  const body = typeof payload.body === "string" ? payload.body : ""
  const category = typeof payload.category === "string" ? payload.category.trim() : ""

  if (!name || !subject || !body.trim() || !category) {
    return null
  }

  return { name, subject, body, category }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const template = await db.emailTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: "template not found" }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("[email template fetch error]", error)
    return NextResponse.json({ error: "failed to load email template" }, { status: 500 })
  }
}

async function updateEmailTemplate(
  request: Request,
  { params }: EmailTemplateRouteContext,
) {
  const { id } = await params

  try {
    const payload = (await request.json()) as Record<string, unknown>
    const parsed = parseTemplateUpdate(payload)

    if (!parsed) {
      return NextResponse.json({ error: "invalid template payload" }, { status: 400 })
    }

    const updated = await db.emailTemplate.update({
      where: { id },
      data: parsed,
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error("[email template update error]", error)
    return NextResponse.json({ error: "failed to update email template" }, { status: 500 })
  }
}

async function archiveEmailTemplate(
  _request: Request,
  { params }: EmailTemplateRouteContext,
) {
  const { id } = await params

  try {
    const deleted = await db.emailTemplate.update({
      where: { id },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({ template: deleted })
  } catch (error) {
    console.error("[email template delete error]", error)
    return NextResponse.json({ error: "failed to delete email template" }, { status: 500 })
  }
}

export const PUT = withAuditTrail<EmailTemplateRouteContext>(
  updateEmailTemplate,
  {
    entity_type: "EmailTemplate",
    action: "UPDATE",
    beforeFn: async (_request, context) =>
      loadEmailTemplateSnapshot(await emailTemplateRouteId(context)),
    afterFn: async (_request, context) =>
      loadEmailTemplateSnapshot(await emailTemplateRouteId(context)),
    entityIdFn: async (_request, context) => emailTemplateRouteId(context),
    metadataFn: async (_request, context, auditContext) => {
      const routeId = await emailTemplateRouteId(context)
      const responseId = await responseEmailTemplateId(auditContext)
      return {
        email_template_id: routeId,
        response_email_template_id: responseId,
      }
    },
  },
)

export const DELETE = withAuditTrail<EmailTemplateRouteContext>(
  archiveEmailTemplate,
  {
    entity_type: "EmailTemplate",
    action: "DELETE",
    beforeFn: async (_request, context) =>
      loadEmailTemplateSnapshot(await emailTemplateRouteId(context)),
    afterFn: async (_request, context) =>
      loadEmailTemplateSnapshot(await emailTemplateRouteId(context)),
    entityIdFn: async (_request, context) => emailTemplateRouteId(context),
    metadataFn: async (_request, context) => ({
      email_template_id: await emailTemplateRouteId(context),
      archived: true,
    }),
  },
)
