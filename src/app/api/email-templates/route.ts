import { NextResponse } from "next/server"

import { db } from "@/lib/db"

function validateTemplateInput(payload: Record<string, unknown>) {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : ""
  const body = typeof payload.body === "string" ? payload.body : ""
  const category = typeof payload.category === "string" ? payload.category.trim() : ""

  if (!name || !subject || !body.trim() || !category) {
    return null
  }

  return { name, subject, body, category }
}

export async function GET() {
  try {
    const templates = await db.emailTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("[email templates list error]", error)
    return NextResponse.json({ error: "failed to load email templates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>
    const parsed = validateTemplateInput(payload)

    if (!parsed) {
      return NextResponse.json({ error: "invalid template payload" }, { status: 400 })
    }

    const template = await db.emailTemplate.create({
      data: {
        ...parsed,
        isActive: true,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error("[email template create error]", error)
    return NextResponse.json({ error: "failed to create email template" }, { status: 500 })
  }
}

