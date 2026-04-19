import type { TaskStatus } from "@prisma/client"

export const STATUS_MAP: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  WAITING_EXTERNAL: "Waiting External",
  WAITING_INTERNAL: "Waiting Internal",
  NEEDS_REVIEW: "Needs Review",
  WITH_CLIENT: "With Client",
  STUCK: "Stuck",
  ON_HOLD: "On Hold",
  DONE: "Done",
  CANCELLED: "Cancelled",
}

export const STATUS_LABEL_TO_STATUS_MAP = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([status, label]) => [label, status as TaskStatus]),
) as Record<string, TaskStatus>
