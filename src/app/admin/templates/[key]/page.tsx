import Link from "next/link"
import { notFound } from "next/navigation"

import { getDriverActionsForAdmin } from "@/lib/adminAdapters"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

type AdminTemplateDetailPageProps = {
  params: Promise<{ key: string }>
}

function formatNullable(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  return String(value)
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "-"
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export default async function AdminTemplateDetailPage({ params }: AdminTemplateDetailPageProps) {
  const { key } = await params

  const [template, nudges] = await Promise.all([
    db.workflow_template.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        name: true,
        trigger_meeting_type_key: true,
        phase_order: true,
        version: true,
        description: true,
        stages: true,
        status: true,
        deployed_at: true,
        created_at: true,
        updated_at: true,
        task_templates: {
          orderBy: {
            sort_order: "asc",
          },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            owner_role: true,
            due_offset_days: true,
            due_date_absolute: true,
            sort_order: true,
            workflow_task_template_outcome: {
              orderBy: {
                sort_order: "asc",
              },
              select: {
                id: true,
                outcome_key: true,
                outcome_label: true,
                sort_order: true,
                is_terminal_lost: true,
                next_phase_key: true,
                spawn_next_task_template_id: true,
                sets_workflow_status: true,
                max_attempts: true,
              },
            },
          },
        },
      },
    }),
    db.workflow_template_nudge.findMany({
      where: {
        workflow_template_key: key,
      },
      orderBy: [
        { decision_state_key: "asc" },
        { driver_action_key: "asc" },
        { nudge_sequence_index: "asc" },
      ],
    }),
  ])

  if (!template) {
    notFound()
  }

  const outcomes = template.task_templates.flatMap((taskTemplate) =>
    taskTemplate.workflow_task_template_outcome.map((outcome) => ({
      ...outcome,
      taskTitle: taskTemplate.title,
      taskSortOrder: taskTemplate.sort_order,
    })),
  )

  const driverActions = getDriverActionsForAdmin().filter((action) =>
    action.eligibleTemplates.includes(template.key),
  )

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[#6b7280]">
            <Link href="/admin/templates" className="hover:underline">
              Workflow Templates
            </Link>
          </p>
          <h1 className="mt-1 text-[22px] font-semibold text-[#113238]">{template.name}</h1>
          <p className="mt-1 font-mono text-[12px] text-[#4b5563]">{template.key}</p>
        </div>
        <div className="rounded-[8px] border border-[#d9e2e7] bg-white px-3 py-2 text-[12px] text-[#4b5563]">
          {template.task_templates.length} tasks / {outcomes.length} outcomes / {nudges.length} nudges
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
          <div className="border-b border-[#edf1f4] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[#113238]">Template metadata</h2>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-4 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Status</dt>
              <dd className="mt-1 text-[#113238]">{template.status}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Version</dt>
              <dd className="mt-1 text-[#113238]">{template.version}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Phase order</dt>
              <dd className="mt-1 text-[#113238]">{formatNullable(template.phase_order)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Trigger meeting type</dt>
              <dd className="mt-1 font-mono text-[12px] text-[#113238]">
                {formatNullable(template.trigger_meeting_type_key)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Deployed at</dt>
              <dd className="mt-1 text-[#113238]">{formatDate(template.deployed_at)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Updated at</dt>
              <dd className="mt-1 text-[#113238]">{formatDate(template.updated_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase text-[#6b7280]">Description</dt>
              <dd className="mt-1 text-[#113238]">{formatNullable(template.description)}</dd>
            </div>
          </dl>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
          <div className="border-b border-[#edf1f4] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[#113238]">Driver actions</h2>
          </div>
          {driverActions.length > 0 ? (
            <div className="divide-y divide-[#edf1f4]">
              {driverActions.map((action) => (
                <div key={action.key} className="px-4 py-3 text-[13px]">
                  <p className="font-mono text-[12px] font-semibold text-[#185F68]">{action.key}</p>
                  <p className="mt-1 text-[#4b5563]">{action.description}</p>
                  <p className="mt-2 text-[12px] text-[#6b7280]">
                    Sends email: {action.sendsEmail ? action.emailTemplateKey : "No"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-[#6b7280]">
              No driver actions are mapped to this template.
            </div>
          )}
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Task templates</h2>
        </div>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Due offset</th>
              <th className="px-4 py-3 text-right">Outcomes</th>
            </tr>
          </thead>
          <tbody>
            {template.task_templates.length > 0 ? (
              template.task_templates.map((taskTemplate) => (
                <tr key={taskTemplate.id} className="border-t border-[#edf1f4]">
                  <td className="px-4 py-3 text-[#4b5563]">{taskTemplate.sort_order}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#113238]">{taskTemplate.title}</p>
                    {taskTemplate.description ? (
                      <p className="mt-1 text-[12px] text-[#6b7280]">{taskTemplate.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">{taskTemplate.owner_role}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{formatNullable(taskTemplate.category)}</td>
                  <td className="px-4 py-3 text-[#4b5563]">
                    {taskTemplate.due_offset_days === null ? "-" : `${taskTemplate.due_offset_days} days`}
                  </td>
                  <td className="px-4 py-3 text-right text-[#113238]">
                    {taskTemplate.workflow_task_template_outcome.length}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">
                  No task templates found for this workflow template.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Outcomes</h2>
        </div>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Next phase</th>
              <th className="px-4 py-3">Workflow status</th>
              <th className="px-4 py-3">Terminal lost</th>
              <th className="px-4 py-3">Max attempts</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.length > 0 ? (
              outcomes.map((outcome) => (
                <tr key={outcome.id} className="border-t border-[#edf1f4]">
                  <td className="px-4 py-3 text-[#4b5563]">{outcome.taskTitle}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#113238]">{outcome.outcome_label}</p>
                    <p className="mt-1 font-mono text-[12px] text-[#6b7280]">{outcome.outcome_key}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {formatNullable(outcome.next_phase_key)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {formatNullable(outcome.sets_workflow_status)}
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">{outcome.is_terminal_lost ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{formatNullable(outcome.max_attempts)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">
                  No outcomes found for this workflow template.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Nudges</h2>
        </div>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="bg-[#F2F4F6] text-[11px] font-semibold uppercase text-[#6b7280]">
            <tr>
              <th className="px-4 py-3">Decision state</th>
              <th className="px-4 py-3">Driver action</th>
              <th className="px-4 py-3">Sequence</th>
              <th className="px-4 py-3">Delay</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Email template</th>
              <th className="px-4 py-3">Terminal</th>
            </tr>
          </thead>
          <tbody>
            {nudges.length > 0 ? (
              nudges.map((nudge) => (
                <tr key={nudge.id} className="border-t border-[#edf1f4]">
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {nudge.decision_state_key}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#185F68]">
                    {nudge.driver_action_key}
                  </td>
                  <td className="px-4 py-3 text-[#113238]">{nudge.nudge_sequence_index}</td>
                  <td className="px-4 py-3 text-[#4b5563]">{nudge.delay_days} days</td>
                  <td className="px-4 py-3 text-[#4b5563]">{nudge.preferred_channel}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#4b5563]">
                    {nudge.email_template_key ? (
                      <Link href={`/admin/email-templates/${nudge.email_template_key}`} className="hover:underline">
                        {nudge.email_template_key}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#4b5563]">
                    {nudge.terminal ? formatNullable(nudge.terminal_outcome_key) : "No"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#6b7280]">
                  No nudges found for this workflow template.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf1f4] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#113238]">Stages JSON</h2>
        </div>
        <pre className="max-h-[360px] overflow-auto px-4 py-4 font-mono text-[12px] leading-5 text-[#374151]">
          {formatJson(template.stages)}
        </pre>
      </section>
    </div>
  )
}
