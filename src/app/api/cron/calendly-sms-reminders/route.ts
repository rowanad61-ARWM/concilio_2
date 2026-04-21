import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import {
  formatCalendlyMeetingTime,
  getCalendlyMeetingTypeLabel,
} from "@/lib/calendly"
import { db } from "@/lib/db"
import { sendSms } from "@/lib/messagemedia"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ReminderDetail = {
  engagement_id: string
  result: string
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return "unknown error"
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function firstNameFromFullName(name: string | null | undefined) {
  if (!name) {
    return "your adviser"
  }

  const firstName = name
    .trim()
    .split(/\s+/)
    .find(Boolean)

  return firstName || "your adviser"
}

function buildReminderSmsBody(params: {
  meetingTypeKey: string | null
  adviserName: string | null
  openedAt: Date
}) {
  const label = getCalendlyMeetingTypeLabel(params.meetingTypeKey)
  const adviserFirstName = firstNameFromFullName(params.adviserName)
  const time = formatCalendlyMeetingTime(params.openedAt)
  if (!time) {
    return null
  }

  return `Reminder: ${label} with ${adviserFirstName} tomorrow at ${time}. Reply to reschedule.`
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SHARED_SECRET?.trim()
  const providedSecret = request.headers.get("x-cron-secret")?.trim() ?? ""

  if (!configuredSecret) {
    console.error("[calendly sms cron] missing CRON_SHARED_SECRET")
    return NextResponse.json({ error: "cron secret not configured" }, { status: 500 })
  }

  if (!providedSecret || !secureEquals(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const engagements = await db.engagement.findMany({
    where: {
      source: "CALENDLY",
      opened_at: {
        gte: now,
        lte: next24Hours,
      },
      reminder_sms_sent_at: null,
    },
    select: {
      id: true,
      meeting_type_key: true,
      opened_at: true,
      party_id: true,
      party: {
        select: {
          person: {
            select: {
              mobile_phone: true,
            },
          },
        },
      },
      user_account: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      opened_at: "asc",
    },
  })

  const details: ReminderDetail[] = []
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const engagement of engagements) {
    const mobile = engagement.party?.person?.mobile_phone?.trim() ?? ""
    if (!engagement.party_id || !mobile) {
      skipped += 1
      details.push({
        engagement_id: engagement.id,
        result: "skipped_missing_party_or_mobile",
      })
      console.info(`[calendly sms cron] skip ${engagement.id} missing party/mobile`)
      continue
    }

    const messageBody = buildReminderSmsBody({
      meetingTypeKey: engagement.meeting_type_key,
      adviserName: engagement.user_account?.name ?? null,
      openedAt: engagement.opened_at,
    })

    if (!messageBody) {
      skipped += 1
      details.push({
        engagement_id: engagement.id,
        result: "skipped_invalid_datetime",
      })
      console.info(`[calendly sms cron] skip ${engagement.id} invalid datetime`)
      continue
    }

    try {
      const sms = await sendSms(mobile, messageBody)
      const marked = await db.engagement.updateMany({
        where: {
          id: engagement.id,
          reminder_sms_sent_at: null,
        },
        data: {
          reminder_sms_sent_at: new Date(),
          reminder_sms_message_id: sms.message_id,
        },
      })

      if (marked.count === 0) {
        skipped += 1
        details.push({
          engagement_id: engagement.id,
          result: "skipped_already_marked_sent",
        })
        continue
      }

      sent += 1
      details.push({
        engagement_id: engagement.id,
        result: "sent",
      })
    } catch (error) {
      failed += 1
      details.push({
        engagement_id: engagement.id,
        result: `failed_send_${toErrorMessage(error)}`,
      })
      console.error(`[calendly sms cron] failed ${engagement.id} ${toErrorMessage(error)}`)
    }
  }

  return NextResponse.json({
    checked: engagements.length,
    sent,
    skipped,
    failed,
    details,
  })
}
