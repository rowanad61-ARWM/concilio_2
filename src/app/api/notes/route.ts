import { NextResponse } from "next/server"

import { db } from "@/lib/db"

type NoteCategory = "phone_call" | "meeting" | "internal" | "action_required" | "fyi"

const VALID_CATEGORIES: NoteCategory[] = [
  "phone_call",
  "meeting",
  "internal",
  "action_required",
  "fyi",
]

const PLACEHOLDER_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"

export async function POST(request: Request) {
  const { partyId, body, category } = await request.json()

  if (!partyId || !body) {
    return NextResponse.json({ error: "partyId and body are required" }, { status: 400 })
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 })
  }

  try {
    const note = await db.file_note.create({
      data: {
        party_id: partyId,
        note_type: category ?? "internal",
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