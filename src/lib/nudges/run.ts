import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { applyMergeFields, type ClientMergeData } from "@/lib/mergeFields"
import { sendNudgeEmail } from "@/lib/nudges/channels/email"
import { sendNudgeSms } from "@/lib/nudges/channels/sms"
import { resolveEmailForParty, resolveMobileForParty } from "@/lib/party-contact"
import {
  createJourneyTimelineEvent,
  setOutcomeForWorkflowInstance,
} from "@/lib/workflow"

const INITIAL_CONTACT_TEMPLATE_KEY = "initial_contact"
const DRIVING_BOOKING_STATE_KEY = "driving_booking"
const SUITABLE_OUTCOME_KEY = "suitable"
const SEND_BOOKING_LINK_ACTION_KEY = "send_booking_link"
const DEFAULT_INITIAL_MEETING_URL = "https://calendly.com/arwm/initial-meeting"
const DAY_MS = 24 * 60 * 60 * 1000

type NudgeChannel = "email" | "sms"
type NudgeChannelStatus = "sent" | "stubbed" | "failed"

type NudgeRunDecision = {
  workflowInstanceId: string
  engagementId: string
  sequenceIndex?: number
  templateKey?: string | null
  channel?: NudgeChannel
  recipient?: string
  dueAt?: string
  terminal?: boolean
  result: string
  detail?: string
}

type NudgeRunError = {
  workflowInstanceId: string
  engagementId: string
  sequenceIndex?: number
  error: string
}

export type RunWorkflowNudgesResult = {
  dry_run: boolean
  instances_processed: number
  nudges_fired: number
  closures_fired: number
  decisions: NudgeRunDecision[]
  errors: NudgeRunError[]
}

type NudgeActor = {
  id: string
  name: string | null
  email: string
}

type NudgeDelivery = {
  channel: NudgeChannel
  recipient: string
  templateKey: string
}

type PartyForNudge = NonNullable<Awaited<ReturnType<typeof loadEligibleInstances>>[number]["engagement"]["party"]>
type NudgeInstance = Awaited<ReturnType<typeof loadEligibleInstances>>[number]
type NudgeTemplate = Awaited<ReturnType<typeof loadNudgeTemplatesForInstance>>[number]

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function firstWord(value: string | null | undefined) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .trim()
    .split(/\s+/)
    .find(Boolean) ?? ""
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function getInitialMeetingBookingUrl() {
  return process.env.CALENDLY_INITIAL_MEETING_URL?.trim() || DEFAULT_INITIAL_MEETING_URL
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

async function loadEligibleInstances() {
  return db.workflow_instance.findMany({
    where: {
      status: "active",
      nudges_muted: false,
      current_outcome_key: SUITABLE_OUTCOME_KEY,
      last_driver_action_at: {
        not: null,
      },
      last_driver_action_key: {
        not: null,
      },
      workflow_template: {
        key: INITIAL_CONTACT_TEMPLATE_KEY,
      },
    },
    include: {
      workflow_template: {
        select: {
          key: true,
        },
      },
      engagement: {
        select: {
          id: true,
          party_id: true,
          household_id: true,
          primary_adviser_id: true,
          party: {
            select: {
              id: true,
              display_name: true,
              person: {
                select: {
                  legal_given_name: true,
                  legal_family_name: true,
                  email_primary: true,
                  mobile_phone: true,
                },
              },
              contact_method: {
                where: {
                  end_date: null,
                },
                select: {
                  channel: true,
                  value: true,
                  preferred_flag: true,
                  do_not_use_flag: true,
                  created_at: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      last_driver_action_at: "asc",
    },
  })
}

async function loadNudgeTemplatesForInstance(instance: NudgeInstance) {
  if (!instance.last_driver_action_key) {
    return []
  }

  return db.workflow_template_nudge.findMany({
    where: {
      workflow_template_key: instance.workflow_template.key,
      decision_state_key: DRIVING_BOOKING_STATE_KEY,
      driver_action_key: instance.last_driver_action_key,
    },
    orderBy: {
      nudge_sequence_index: "asc",
    },
  })
}

async function loadExistingNudgeTemplateIds(instanceId: string) {
  const rows = await db.workflow_instance_nudge.findMany({
    where: {
      workflow_instance_id: instanceId,
    },
    select: {
      nudge_template_id: true,
    },
  })

  return new Set(rows.map((row) => row.nudge_template_id))
}

async function resolveActorForInstance(instance: NudgeInstance): Promise<NudgeActor> {
  if (instance.engagement.primary_adviser_id) {
    const adviser = await db.user_account.findUnique({
      where: {
        id: instance.engagement.primary_adviser_id,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (adviser) {
      return adviser
    }
  }

  const fallback = await db.user_account.findFirst({
    orderBy: {
      created_at: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  if (!fallback) {
    throw new Error("No user_account exists for nudge sender.")
  }

  return fallback
}

function buildMergeData(party: PartyForNudge): ClientMergeData {
  const email = resolveEmailForParty(party) ?? ""
  const phone = resolveMobileForParty(party) ?? ""

  return {
    firstName: party.person?.legal_given_name || firstWord(party.display_name) || "there",
    lastName: party.person?.legal_family_name ?? "",
    fullName: party.display_name,
    email,
    phone,
  }
}

function resolveDelivery(params: {
  nudgeTemplate: NudgeTemplate
  party: PartyForNudge
}): NudgeDelivery {
  const { nudgeTemplate, party } = params
  const preferredChannel = nudgeTemplate.preferred_channel
  const email = resolveEmailForParty(party)
  const mobile = resolveMobileForParty(party)

  if (preferredChannel === "sms") {
    if (mobile && nudgeTemplate.sms_template_key) {
      return {
        channel: "sms",
        recipient: mobile,
        templateKey: nudgeTemplate.sms_template_key,
      }
    }

    if (email && nudgeTemplate.email_template_key) {
      return {
        channel: "email",
        recipient: email,
        templateKey: nudgeTemplate.email_template_key,
      }
    }
  }

  if (preferredChannel === "email") {
    if (email && nudgeTemplate.email_template_key) {
      return {
        channel: "email",
        recipient: email,
        templateKey: nudgeTemplate.email_template_key,
      }
    }
  }

  throw new Error("No usable nudge recipient/template for preferred channel.")
}

async function loadActiveTemplate(templateKey: string, channel: NudgeChannel) {
  const template = await db.emailTemplate.findUnique({
    where: {
      id: templateKey,
    },
    select: {
      id: true,
      body: true,
      channel: true,
      isActive: true,
    },
  })

  if (!template || !template.isActive) {
    throw new Error(`Template "${templateKey}" is missing or inactive.`)
  }

  if (template.channel !== channel) {
    throw new Error(`Template "${templateKey}" is not a ${channel} template.`)
  }

  return template
}

async function sendResolvedNudge(params: {
  instance: NudgeInstance
  actor: NudgeActor
  delivery: NudgeDelivery
}): Promise<{
  status: NudgeChannelStatus
  detail?: string
}> {
  if (params.delivery.channel === "email") {
    return sendNudgeEmail({
      templateId: params.delivery.templateKey,
      engagement: {
        party_id: params.instance.engagement.party_id,
      },
      actorUserId: params.actor.id,
    })
  }

  const party = params.instance.engagement.party
  if (!party) {
    return {
      status: "failed",
      detail: "Engagement has no linked party.",
    }
  }

  try {
    const template = await loadActiveTemplate(params.delivery.templateKey, "sms")
    const body = applyMergeFields(template.body, buildMergeData(party), {
      clientFirstName: party.person?.legal_given_name || firstWord(party.display_name) || "there",
      adviserName: params.actor.name || "Andrew Rowan",
      calendlyInitialMeetingUrl: getInitialMeetingBookingUrl(),
    })

    return sendNudgeSms({
      recipient: params.delivery.recipient,
      body,
      templateKey: params.delivery.templateKey,
      workflowInstanceId: params.instance.id,
    })
  } catch (error) {
    return {
      status: "failed",
      detail: toErrorMessage(error),
    }
  }
}

async function insertNudgeLogAndTimeline(params: {
  instance: NudgeInstance
  nudgeTemplate: NudgeTemplate
  delivery: NudgeDelivery
  status: NudgeChannelStatus
  detail?: string
  now: Date
}) {
  try {
    await db.$transaction(async (tx) => {
      await tx.workflow_instance_nudge.create({
        data: {
          workflow_instance_id: params.instance.id,
          nudge_template_id: params.nudgeTemplate.id,
          channel: params.delivery.channel,
          channel_status: params.status,
          recipient: params.delivery.recipient,
          fired_at: params.now,
          error_detail: params.detail ?? null,
        },
      })

      if (params.status !== "failed") {
        const statusSuffix = params.status === "stubbed" ? " (stubbed)" : ""
        await createJourneyTimelineEvent(tx, {
          engagementId: params.instance.engagement.id,
          partyId: params.instance.engagement.party_id,
          householdId: params.instance.engagement.household_id,
          primaryAdviserId: params.instance.engagement.primary_adviser_id,
          note: `Nudge ${params.nudgeTemplate.nudge_sequence_index} sent: ${params.delivery.templateKey} via ${params.delivery.channel}${statusSuffix}`,
          at: params.now,
        })
      }
    })

    return "inserted" as const
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return "duplicate" as const
    }

    throw error
  }
}

async function emitClosureTimelineEvent(params: {
  instance: NudgeInstance
  nudgeTemplate: NudgeTemplate
  now: Date
}) {
  await db.$transaction(async (tx) => {
    await createJourneyTimelineEvent(tx, {
      engagementId: params.instance.engagement.id,
      partyId: params.instance.engagement.party_id,
      householdId: params.instance.engagement.household_id,
      primaryAdviserId: params.instance.engagement.primary_adviser_id,
      note: `File closed - no response after ${params.nudgeTemplate.nudge_sequence_index} nudges`,
      at: params.now,
    })
  })
}

export async function runWorkflowNudges(options?: {
  dryRun?: boolean
  now?: Date
}): Promise<RunWorkflowNudgesResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const result: RunWorkflowNudgesResult = {
    dry_run: dryRun,
    instances_processed: 0,
    nudges_fired: 0,
    closures_fired: 0,
    decisions: [],
    errors: [],
  }

  const instances = await loadEligibleInstances()
  result.instances_processed = instances.length

  for (const instance of instances) {
    const engagementId = instance.engagement.id
    const templates = await loadNudgeTemplatesForInstance(instance)
    if (templates.length === 0) {
      result.decisions.push({
        workflowInstanceId: instance.id,
        engagementId,
        result: "no_config",
      })
      continue
    }

    const existingTemplateIds = await loadExistingNudgeTemplateIds(instance.id)
    const actor = await resolveActorForInstance(instance)

    for (const nudgeTemplate of templates) {
      if (existingTemplateIds.has(nudgeTemplate.id)) {
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          terminal: nudgeTemplate.terminal,
          result: "already_fired",
        })
        continue
      }

      if (!instance.last_driver_action_at) {
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          terminal: nudgeTemplate.terminal,
          result: "missing_driver_action_at",
        })
        break
      }

      const dueAt = addDays(instance.last_driver_action_at, nudgeTemplate.delay_days)
      if (dueAt.getTime() > now.getTime()) {
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          dueAt: dueAt.toISOString(),
          terminal: nudgeTemplate.terminal,
          result: "not_due",
        })
        break
      }

      if (!instance.engagement.party) {
        const message = "Engagement has no linked party."
        result.errors.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          error: message,
        })
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          dueAt: dueAt.toISOString(),
          terminal: nudgeTemplate.terminal,
          result: "error",
          detail: message,
        })
        break
      }

      let delivery: NudgeDelivery
      try {
        delivery = resolveDelivery({
          nudgeTemplate,
          party: instance.engagement.party,
        })
      } catch (error) {
        const message = toErrorMessage(error)
        result.errors.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          error: message,
        })
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          dueAt: dueAt.toISOString(),
          terminal: nudgeTemplate.terminal,
          result: "error",
          detail: message,
        })
        break
      }

      if (dryRun) {
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          templateKey: delivery.templateKey,
          channel: delivery.channel,
          recipient: delivery.recipient,
          dueAt: dueAt.toISOString(),
          terminal: nudgeTemplate.terminal,
          result: nudgeTemplate.terminal ? "would_fire_and_close" : "would_fire",
        })
        continue
      }

      const sendResult = await sendResolvedNudge({
        instance,
        actor,
        delivery,
      })

      try {
        const insertResult = await insertNudgeLogAndTimeline({
          instance,
          nudgeTemplate,
          delivery,
          status: sendResult.status,
          detail: sendResult.detail,
          now,
        })

        if (insertResult === "duplicate") {
          result.decisions.push({
            workflowInstanceId: instance.id,
            engagementId,
            sequenceIndex: nudgeTemplate.nudge_sequence_index,
            templateKey: delivery.templateKey,
            channel: delivery.channel,
            recipient: delivery.recipient,
            terminal: nudgeTemplate.terminal,
            result: "already_fired",
          })
          continue
        }
      } catch (error) {
        const message = toErrorMessage(error)
        result.errors.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          error: message,
        })
        result.decisions.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          templateKey: delivery.templateKey,
          channel: delivery.channel,
          recipient: delivery.recipient,
          terminal: nudgeTemplate.terminal,
          result: "error",
          detail: message,
        })
        break
      }

      result.nudges_fired += 1
      result.decisions.push({
        workflowInstanceId: instance.id,
        engagementId,
        sequenceIndex: nudgeTemplate.nudge_sequence_index,
        templateKey: delivery.templateKey,
        channel: delivery.channel,
        recipient: delivery.recipient,
        dueAt: dueAt.toISOString(),
        terminal: nudgeTemplate.terminal,
        result: sendResult.status,
        detail: sendResult.detail,
      })

      if (sendResult.status === "failed") {
        result.errors.push({
          workflowInstanceId: instance.id,
          engagementId,
          sequenceIndex: nudgeTemplate.nudge_sequence_index,
          error: sendResult.detail ?? "nudge send failed",
        })
        break
      }

      if (nudgeTemplate.terminal && nudgeTemplate.terminal_outcome_key) {
        try {
          await setOutcomeForWorkflowInstance(instance.id, nudgeTemplate.terminal_outcome_key, actor.id)
          await emitClosureTimelineEvent({
            instance,
            nudgeTemplate,
            now,
          })
          result.closures_fired += 1
        } catch (error) {
          const message = toErrorMessage(error)
          result.errors.push({
            workflowInstanceId: instance.id,
            engagementId,
            sequenceIndex: nudgeTemplate.nudge_sequence_index,
            error: message,
          })
        }
      }
    }
  }

  return result
}
