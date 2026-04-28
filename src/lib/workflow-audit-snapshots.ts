import { db } from "@/lib/db"
import type { AuditSnapshot } from "@/lib/audit"
import type { AuditLifecycleContext } from "@/lib/audit-middleware"

export type IdRouteContext = { params: Promise<{ id: string }> }

export async function routeParamId(context: IdRouteContext): Promise<string> {
  const { id } = await context.params
  return id
}

export async function responseJson<T>(
  auditContext: AuditLifecycleContext,
): Promise<T | null> {
  if (!auditContext.response) {
    return null
  }

  try {
    return (await auditContext.response.clone().json()) as T
  } catch {
    return null
  }
}

export async function responseId(
  auditContext: AuditLifecycleContext,
): Promise<string | null> {
  const payload = await responseJson<{ id?: unknown }>(auditContext)
  return typeof payload?.id === "string" ? payload.id : null
}

const workflowTemplateSelect = {
  id: true,
  key: true,
  name: true,
  phase_order: true,
  version: true,
  status: true,
} as const

const spawnedTaskSelect = {
  id: true,
  task_id: true,
  outcome_key: true,
  outcome_set_at: true,
  outcome_set_by: true,
  created_at: true,
  task: {
    select: {
      id: true,
      title: true,
      status: true,
      dueDateStart: true,
      dueDateEnd: true,
      completedAt: true,
    },
  },
} as const

const nudgeSelect = {
  id: true,
  nudge_template_id: true,
  channel: true,
  channel_status: true,
  recipient: true,
  fired_at: true,
  error_detail: true,
  created_at: true,
} as const

export async function loadEngagementSnapshot(id: string): Promise<AuditSnapshot> {
  return db.engagement.findUnique({
    where: { id },
    include: {
      workflow_instance: {
        orderBy: {
          created_at: "asc",
        },
        include: {
          workflow_template: {
            select: workflowTemplateSelect,
          },
          spawned_tasks: {
            orderBy: {
              created_at: "asc",
            },
            select: spawnedTaskSelect,
          },
          workflow_instance_nudge: {
            orderBy: {
              created_at: "asc",
            },
            select: nudgeSelect,
          },
        },
      },
    },
  })
}

export async function loadWorkflowInstanceSnapshot(
  id: string,
): Promise<AuditSnapshot> {
  return db.workflow_instance.findUnique({
    where: { id },
    include: {
      workflow_template: {
        select: workflowTemplateSelect,
      },
      engagement: {
        select: {
          id: true,
          engagement_type: true,
          status: true,
          source: true,
          household_id: true,
          party_id: true,
          primary_adviser_id: true,
          opened_at: true,
          completed_at: true,
          updated_at: true,
        },
      },
      spawned_tasks: {
        orderBy: {
          created_at: "asc",
        },
        select: spawnedTaskSelect,
      },
      workflow_instance_nudge: {
        orderBy: {
          created_at: "asc",
        },
        select: nudgeSelect,
      },
    },
  })
}
