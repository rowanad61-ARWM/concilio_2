export const INITIAL_CONTACT_TEMPLATE_KEY = "initial_contact"
export const INITIAL_MEETING_TEMPLATE_KEY = "initial_meeting"
export const DISCOVERY_TEMPLATE_KEY = "discovery"
export const ENGAGEMENT_TEMPLATE_KEY = "engagement"

export const DECISION_STATE_TEMPLATE_KEYS = [
  INITIAL_CONTACT_TEMPLATE_KEY,
  INITIAL_MEETING_TEMPLATE_KEY,
  DISCOVERY_TEMPLATE_KEY,
  ENGAGEMENT_TEMPLATE_KEY,
] as const

const ON_HOLD_OUTCOME_KEY = "on_hold"
const SUITABLE_OUTCOME_KEY = "suitable"
const PROCEEDING_TO_DISCOVERY_OUTCOME_KEY = "proceeding_to_discovery"
const INITIAL_CONTACT_MEETING_DURATION_MS = 15 * 60 * 1000
const OUTCOME_READY_BUFFER_MS = 60 * 60 * 1000

export type WorkflowDecisionState =
  | "awaiting_event"
  | "ready_for_outcome"
  | "driving_booking"
  | "driving_engagement_doc"
  | "paused"

export type WorkflowUrgency = "green" | "orange" | "red"

export type WorkflowDecisionStateSnapshot = {
  state: WorkflowDecisionState
  awaitingEventEndsAt: Date | null
  urgency?: WorkflowUrgency
}

export type WorkflowStateInstance = {
  status: string
  trigger_date: Date
  scheduled_start_date?: Date | null
  current_outcome_key: string | null
  last_driver_action_key?: string | null
  last_driver_action_at?: Date | null
  workflow_template: {
    key: string
  }
}

export function usesDecisionStateTemplate(templateKey: string) {
  return DECISION_STATE_TEMPLATE_KEYS.includes(templateKey as (typeof DECISION_STATE_TEMPLATE_KEYS)[number])
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds)
}

function isPaused(instance: WorkflowStateInstance) {
  return instance.status === "paused" || instance.current_outcome_key === ON_HOLD_OUTCOME_KEY
}

function readyForOutcome(): WorkflowDecisionStateSnapshot {
  return {
    state: "ready_for_outcome",
    awaitingEventEndsAt: null,
  }
}

function deriveMeetingOutcomeState(
  instance: WorkflowStateInstance,
  options: {
    now: Date
    isDrivingBookingOutcome: (instance: WorkflowStateInstance) => boolean
  },
): WorkflowDecisionStateSnapshot {
  if (isPaused(instance)) {
    return {
      state: "paused",
      awaitingEventEndsAt: null,
    }
  }

  if (!instance.current_outcome_key) {
    const awaitingEventEndsAt = addMilliseconds(
      instance.trigger_date,
      INITIAL_CONTACT_MEETING_DURATION_MS + OUTCOME_READY_BUFFER_MS,
    )

    if (awaitingEventEndsAt.getTime() > options.now.getTime()) {
      return {
        state: "awaiting_event",
        awaitingEventEndsAt,
      }
    }

    return readyForOutcome()
  }

  if (options.isDrivingBookingOutcome(instance)) {
    return {
      state: "driving_booking",
      awaitingEventEndsAt: null,
    }
  }

  return readyForOutcome()
}

export function deriveInitialContactState(
  instance: WorkflowStateInstance,
  options?: { now?: Date },
): WorkflowDecisionStateSnapshot {
  return deriveMeetingOutcomeState(instance, {
    now: options?.now ?? new Date(),
    isDrivingBookingOutcome: (candidate) => candidate.current_outcome_key === SUITABLE_OUTCOME_KEY,
  })
}

export function deriveInitialMeetingState(
  instance: WorkflowStateInstance,
  options?: { now?: Date },
): WorkflowDecisionStateSnapshot {
  return deriveMeetingOutcomeState(instance, {
    now: options?.now ?? new Date(),
    isDrivingBookingOutcome: (candidate) =>
      candidate.current_outcome_key === PROCEEDING_TO_DISCOVERY_OUTCOME_KEY,
  })
}

export function deriveDiscoveryState(
  instance: WorkflowStateInstance,
  options?: { now?: Date },
): WorkflowDecisionStateSnapshot {
  return deriveMeetingOutcomeState(instance, {
    now: options?.now ?? new Date(),
    isDrivingBookingOutcome: (candidate) => candidate.current_outcome_key === SUITABLE_OUTCOME_KEY,
  })
}

export function deriveEngagementState(instance: WorkflowStateInstance): WorkflowDecisionStateSnapshot {
  if (isPaused(instance)) {
    return {
      state: "paused",
      awaitingEventEndsAt: null,
    }
  }

  if (instance.status === "active" && !instance.current_outcome_key) {
    return {
      state: "driving_engagement_doc",
      awaitingEventEndsAt: null,
    }
  }

  return readyForOutcome()
}

export function deriveDecisionState(
  instance: WorkflowStateInstance,
  options?: { now?: Date },
): WorkflowDecisionStateSnapshot | null {
  switch (instance.workflow_template.key) {
    case INITIAL_CONTACT_TEMPLATE_KEY:
      return deriveInitialContactState(instance, options)
    case INITIAL_MEETING_TEMPLATE_KEY:
      return deriveInitialMeetingState(instance, options)
    case DISCOVERY_TEMPLATE_KEY:
      return deriveDiscoveryState(instance, options)
    case ENGAGEMENT_TEMPLATE_KEY:
      return deriveEngagementState(instance)
    default:
      return null
  }
}
