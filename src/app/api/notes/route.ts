import { NextResponse } from "next/server"

import { db } from "@/lib/db"

type NoteCategory = "general" | "meeting" | "phone_call" | "email" | "compliance" | "other"

const VALID_CATEGORIES: NoteCategory[] = [
  "general",
  "meeting",
  "phone_call",
  "email",
  "compliance",
  "other",
]

const PLACEHOLDER_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"

export async function POST(request: Request) {
  const { partyId, body, category } = await request.json()

  if (!partyId || !body) {
    return NextResponse.json({ error: "partyId and body are required" }, { status: 400 })
  }

  const noteType = category && VALID_CATEGORIES.includes(category) ? category : "general"

  try {
    const note = await db.file_note.create({
      data: {
        party_id: partyId,
        note_type: noteType,
        text: body,
        author_user_id: PLACEHOLDER_AUTHOR_ID,
        created_at: new Date(),
      },
    })

    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: "failed to create note" }, { status: 500 })
  }
}