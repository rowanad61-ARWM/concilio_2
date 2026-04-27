import "server-only"

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { db } from "@/lib/db"

const ADMIN_ROLES = ["owner"] as const

type AdminRole = (typeof ADMIN_ROLES)[number]

function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole)
}

export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
}

export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth()
  if (!session) {
    redirect("/api/auth/signin")
  }

  const sessionEmail = session.user?.email?.trim().toLowerCase() ?? ""
  if (!sessionEmail) {
    redirect("/api/auth/signin")
  }

  const user = await db.user_account.findUnique({
    where: {
      email: sessionEmail,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  })

  if (!user || user.status !== "active" || !isAdminRole(user.role)) {
    redirect("/dashboard")
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}
