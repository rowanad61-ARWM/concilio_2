import type { NudgeChannelSendResult } from "@/lib/nudges/channels/email"

export async function sendNudgeSms(params: {
  recipient: string
  body: string
  templateKey: string
  workflowInstanceId: string
}): Promise<NudgeChannelSendResult> {
  console.info(
    `[nudges sms stub] instance=${params.workflowInstanceId} recipient=${params.recipient} template=${params.templateKey} length=${params.body.length}`,
  )

  return {
    status: "stubbed",
    detail: "sms_provider_not_configured",
  }
}
