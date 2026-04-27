export const INITIAL_CONTACT_TEMPLATE_KEY = "initial_contact"
export const INITIAL_MEETING_TEMPLATE_KEY = "initial_meeting"
export const DISCOVERY_TEMPLATE_KEY = "discovery"
export const ENGAGEMENT_TEMPLATE_KEY = "engagement"
export const ADVICE_TEMPLATE_KEY = "advice"
export const IMPLEMENTATION_TEMPLATE_KEY = "implementation"

export const DECISION_STATE_TEMPLATE_KEYS = [
  INITIAL_CONTACT_TEMPLATE_KEY,
  INITIAL_MEETING_TEMPLATE_KEY,
  DISCOVERY_TEMPLATE_KEY,
  ENGAGEMENT_TEMPLATE_KEY,
  ADVICE_TEMPLATE_KEY,
  IMPLEMENTATION_TEMPLATE_KEY,
] as const

const ON_HOLD_OUTCOME_KEY = "on_hold"
const SUITABLE_OUTCOME_KEY = "suitable"
const PROCEEDING_TO_DISCOVERY_OUTCOME_KEY = "proceeding_to_discovery"
const SEND_ADVICE_BOOKING_LINK_ACTION_KEY = "send_advice_booking_link"
const RECORD_SOA_DELIVERED_ACTION_KEY = "record_soa_delivered"
const MANUALLY_MARK_AUTHORITY_SIGNED_ACTION_KEY = "manually_mark_authority_signed"
const INITIAL_CONTACT_MEETING_DURATION_MS = 15 * 60 * 1000
const OUTCOME_READY_BUFFER_MS = 60 * 60 * 1000
export const ADVICE_MEETING_DURATION_MS = 75 * 60 * 1000
export const ADVICE_PREP_GREEN_DAYS = 7
export const ADVICE_PREP_ORANGE_DAYS = 11
export const ADVICE_DELIVERY_GREEN_DAYS = 3
export const ADVICE_DELIVERY_ORANGE_DAYS = 5
const DAY_MS = 24 * 60 * 60 * 1000

export type WorkflowDecisionState =
  | "awaiting_event"
  | "ready_for_outcome"
  | "driving_booking"
  | "driving_engagement_doc"
  | "driving_meeting_booking"
  | "driving_advice_prep"
  | "driving_advice_delivery"
  | "driving_authority_signature"
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

function elapsedWholeDaysSince(date: Date, now: Date) {
  return Math.floor(Math.max(0, now.getTime() - date.getTime()) / DAY_MS)
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

export function urgencyForAdvicePrep(
  lastDriverActionAt: Date,
  options?: { now?: Date },
): WorkflowUrgency {
  const elapsedDays = elapsedWholeDaysSince(lastDriverActionAt, options?.now ?? new Date())
  if (elapsedDays <= ADVICE_PREP_GREEN_DAYS) {
    return "green"
  }

  if (elapsedDays <= ADVICE_PREP_ORANGE_DAYS) {
    return "orange"
  }

  return "red"
}

export function urgencyForAdviceDelivery(
  scheduledStartDate: Date,
  options?: { now?: Date },
): WorkflowUrgency {
  const elapsedDays = elapsedWholeDaysSince(scheduledStartDate, options?.now ?? new Date())
  if (elapsedDays <= ADVICE_DELIVERY_GREEN_DAYS) {
    return "green"
  }

  if (elapsedDays <= ADVICE_DELIVERY_ORANGE_DAYS) {
    return "orange"
  }

  return "red"
}

export function deriveAdviceState(
  instance: WorkflowStateInstance,
  options?: { now?: Date },
): WorkflowDecisionStateSnapshot {
  if (isPaused(instance)) {
    return {
      state: "paused",
      awaitingEventEndsAt: null,
    }
  }

  if (instance.last_driver_action_key === MANUALLY_MARK_AUTHORITY_SIGNED_ACTION_KEY) {
    return readyForOutcome()
  }

  if (instance.last_driver_action_key === RECORD_SOA_DELIVERED_ACTION_KEY) {
    return {
      state: "driving_authority_signature",
      awaitingEventEndsAt: null,
    }
  }

  const now = options?.now ?? new Date()
  if (!instance.scheduled_start_date) {
    return {
      state: "driving_meeting_booking",
      awaitingEventEndsAt: null,
    }
  }

  const awaitingEventEndsAt = addMilliseconds(instance.scheduled_start_date, ADVICE_MEETING_DURATION_MS)
  if (awaitingEventEndsAt.getTime() <= now.getTime()) {
    return {
      state: "driving_advice_delivery",
      awaitingEventEndsAt: null,
      urgency: urgencyForAdviceDelivery(instance.scheduled_start_date, { now }),
    }
  }

  if (
    instance.last_driver_action_key === SEND_ADVICE_BOOKING_LINK_ACTION_KEY &&
    instance.last_driver_action_at
  ) {
    return {
      state: "driving_advice_prep",
      awaitingEventEndsAt,
      urgency: urgencyForAdvicePrep(instance.last_driver_action_at, { now }),
    }
  }

  return {
    state: "awaiting_event",
    awaitingEventEndsAt,
  }
}

export function deriveImplementationState(instance: WorkflowStateInstance): WorkflowDecisionStateSnapshot {
  if (isPaused(instance)) {
    return {
      state: "paused",
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
    case ADVICE_TEMPLATE_KEY:
      return deriveAdviceState(instance, options)
    case IMPLEMENTATION_TEMPLATE_KEY:
      return deriveImplementationState(instance)
    default:
      return null
  }
}
