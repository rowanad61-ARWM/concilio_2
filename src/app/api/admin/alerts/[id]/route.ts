import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { withAuditTrail } from "@/lib/audit-middleware"
import { db } from "@/lib/db"

type AdminAlertRouteContext = { params: Promise<{ id: string }> }

async function routeParamId(context: AdminAlertRouteContext): Promise<string> {
  const { id } = await context.params
  return id
}

async function requireAdminActor() {
  const session = await auth()
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? ""
  if (!sessionEmail) {
    return null
  }

  const user = await db.user_account.findUnique({
    where: { email: sessionEmail },
    select: {
      id: true,
      role: true,
      status: true,
    },
  })

  if (!user || user.status !== "active" || user.role !== "owner") {
    return null
  }

  return user
}

async function loadAlertSnapshot(id: string) {
  return db.alert_instance.findUnique({
    where: { id },
    select: {
      id: true,
      occurred_at: true,
      alert_type: true,
      entity_type: true,
      entity_id: true,
      payload: true,
      acknowledged_at: true,
      cleared_at: true,
      acknowledged_by_user_id: true,
      audit_event_id: true,
    },
  })
}

async function acknowledgeAlert(
  _request: Request,
  context: AdminAlertRouteContext,
) {
  const actor = await requireAdminActor()
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const id = await routeParamId(context)
  const existing = await db.alert_instance.findUnique({
    where: { id },
    select: {
      id: true,
      acknowledged_at: true,
      cleared_at: true,
      acknowledged_by_user_id: true,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "alert not found" }, { status: 404 })
  }

  if (existing.acknowledged_at) {
    return NextResponse.json({
      alert: {
        id: existing.id,
        acknowledged_at: existing.acknowledged_at.toISOString(),
        acknowledged_by_user_id: existing.acknowledged_by_user_id,
      },
      alreadyAcknowledged: true,
    })
  }

  const updated = await db.alert_instance.update({
    where: { id },
    data: {
      acknowledged_at: new Date(),
      cleared_at: new Date(),
      acknowledged_by_user_id: actor.id,
    },
    select: {
      id: true,
      acknowledged_at: true,
      acknowledged_by_user_id: true,
    },
  })

  return NextResponse.json({
    alert: {
      id: updated.id,
      acknowledged_at: updated.acknowledged_at?.toISOString() ?? null,
      acknowledged_by_user_id: updated.acknowledged_by_user_id,
    },
  })
}

export const PATCH = withAuditTrail<AdminAlertRouteContext>(acknowledgeAlert, {
  entity_type: "alert_instance",
  action: "UPDATE",
  beforeFn: async (_request, context) => loadAlertSnapshot(await routeParamId(context)),
  afterFn: async (_request, context) => loadAlertSnapshot(await routeParamId(context)),
  entityIdFn: async (_request, context) => routeParamId(context),
  metadataFn: async () => ({ admin_action: "acknowledge_alert" }),
})
