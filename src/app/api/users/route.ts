import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const users = await db.user_account.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        fullName: user.name,
        email: user.email,
      })),
    })
  } catch (error) {
    console.error("[users list error]", error)
    return NextResponse.json({ error: "failed to load users" }, { status: 500 })
  }
}
