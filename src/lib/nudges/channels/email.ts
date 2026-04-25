import { db } from "@/lib/db"
import { sendWorkflowTemplateToClient } from "@/lib/workflow"

export type NudgeChannelSendStatus = "sent" | "stubbed" | "failed"

export type NudgeChannelSendResult = {
  status: NudgeChannelSendStatus
  detail?: string
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

export async function sendNudgeEmail(params: {
  templateId: string
  engagement: {
    party_id: string | null
  }
  actorUserId: string
}): Promise<NudgeChannelSendResult> {
  try {
    await sendWorkflowTemplateToClient(db, {
      templateId: params.templateId,
      engagement: params.engagement,
      actorUserId: params.actorUserId,
    })

    return { status: "sent" }
  } catch (error) {
    return {
      status: "failed",
      detail: toErrorMessage(error),
    }
  }
}
