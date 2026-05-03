import "server-only"

import { auth } from "@/auth"
import { db } from "@/lib/db"

type SessionLike = {
  user?: {
    id?: unknown
    email?: unknown
  }
} | null

function sessionUserId(session: SessionLike) {
  const id = session?.user?.id
  return typeof id === "string" && id.trim() ? id.trim() : null
}

function sessionEmail(session: SessionLike) {
  const email = session?.user?.email
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null
}

export async function resolveCurrentUser() {
  const session = await auth()
  const email = sessionEmail(session)
  const authSubject = sessionUserId(session)

  if (!email && !authSubject) {
    return null
  }

  return db.user_account.findFirst({
    where: {
      status: "active",
      OR: [
        ...(email ? [{ email }] : []),
        ...(authSubject ? [{ auth_subject: authSubject }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  })
}
