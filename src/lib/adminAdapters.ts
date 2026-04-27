import "server-only"

export type AdminDriverAction = {
  key: string
  eligibleTemplates: string[]
  eligibleStates: string[]
  sendsEmail: boolean
  emailTemplateKey: string | null
  description: string
}

export type AdminConstant = {
  category: string
  name: string
  value: string
  fileLine: string
  description: string
}

export function getDriverActionsForAdmin(): AdminDriverAction[] {
  return [
    {
      key: "send_booking_link",
      eligibleTemplates: ["initial_contact"],
      eligibleStates: ["current_outcome_key=suitable"],
      sendsEmail: true,
      emailTemplateKey: "calendly_initial_meeting_booking_link",
      description: "Initial Contact action that emails the initial meeting booking link.",
    },
    {
      key: "book_in_calendly",
      eligibleTemplates: ["initial_contact"],
      eligibleStates: ["current_outcome_key=suitable"],
      sendsEmail: false,
      emailTemplateKey: null,
      description: "Initial Contact action used when the Calendly booking is handled directly.",
    },
    {
      key: "send_discovery_booking_link",
      eligibleTemplates: ["initial_meeting"],
      eligibleStates: ["current_outcome_key=proceeding_to_discovery"],
      sendsEmail: true,
      emailTemplateKey: "discovery_booking_link",
      description: "Initial Meeting action that emails the discovery meeting booking link.",
    },
    {
      key: "send_engagement_doc",
      eligibleTemplates: ["engagement"],
      eligibleStates: ["decision_state=driving_engagement_doc"],
      sendsEmail: true,
      emailTemplateKey: "engagement_doc",
      description: "Engagement action that emails the engagement document prompt.",
    },
    {
      key: "send_advice_booking_link",
      eligibleTemplates: ["advice"],
      eligibleStates: ["decision_state=driving_meeting_booking"],
      sendsEmail: true,
      emailTemplateKey: "advice_booking_link",
      description: "Advice action that emails the advice meeting booking link.",
    },
    {
      key: "record_soa_delivered",
      eligibleTemplates: ["advice"],
      eligibleStates: ["decision_state=driving_advice_delivery"],
      sendsEmail: true,
      emailTemplateKey: "authority_to_proceed",
      description: "Advice action that records SoA delivery and emails authority-to-proceed material.",
    },
    {
      key: "manually_mark_authority_signed",
      eligibleTemplates: ["advice"],
      eligibleStates: ["decision_state=driving_authority_signature"],
      sendsEmail: false,
      emailTemplateKey: null,
      description: "Advice action for manually recording a signed authority to proceed.",
    },
  ]
}

export function getConstantsForAdmin(): AdminConstant[] {
  return [
    {
      category: "Workflow template keys",
      name: "INITIAL_CONTACT_TEMPLATE_KEY",
      value: "initial_contact",
      fileLine: "src/lib/workflowState.ts:1",
      description: "Start of the workflow chain.",
    },
    {
      category: "Workflow template keys",
      name: "INITIAL_MEETING_TEMPLATE_KEY",
      value: "initial_meeting",
      fileLine: "src/lib/workflowState.ts:2",
      description: "Initial meeting phase key.",
    },
    {
      category: "Workflow template keys",
      name: "DISCOVERY_TEMPLATE_KEY",
      value: "discovery",
      fileLine: "src/lib/workflowState.ts:3",
      description: "Discovery phase key.",
    },
    {
      category: "Workflow template keys",
      name: "ENGAGEMENT_TEMPLATE_KEY",
      value: "engagement",
      fileLine: "src/lib/workflowState.ts:4",
      description: "Engagement phase key.",
    },
    {
      category: "Workflow template keys",
      name: "ADVICE_TEMPLATE_KEY",
      value: "advice",
      fileLine: "src/lib/workflowState.ts:5",
      description: "Advice phase key.",
    },
    {
      category: "Workflow template keys",
      name: "IMPLEMENTATION_TEMPLATE_KEY",
      value: "implementation",
      fileLine: "src/lib/workflowState.ts:6",
      description: "Implementation phase key.",
    },
    {
      category: "Decision-state templates",
      name: "DECISION_STATE_TEMPLATE_KEYS",
      value: "initial_contact, initial_meeting, discovery, engagement, advice, implementation",
      fileLine: "src/lib/workflowState.ts:8",
      description: "Templates that can expose Journey decision-state behavior.",
    },
    {
      category: "Decision states",
      name: "AWAITING_EVENT_DECISION_STATE",
      value: "awaiting_event",
      fileLine: "src/lib/workflowState.ts:17",
      description: "Waiting for the scheduled meeting or event to occur.",
    },
    {
      category: "Decision states",
      name: "READY_FOR_OUTCOME_DECISION_STATE",
      value: "ready_for_outcome",
      fileLine: "src/lib/workflowState.ts:18",
      description: "Outcome controls can be shown for the current workflow instance.",
    },
    {
      category: "Decision states",
      name: "DRIVING_BOOKING_DECISION_STATE",
      value: "driving_booking",
      fileLine: "src/lib/workflowState.ts:19",
      description: "Journey state for driving a booking action.",
    },
    {
      category: "Decision states",
      name: "DRIVING_ENGAGEMENT_DOC_DECISION_STATE",
      value: "driving_engagement_doc",
      fileLine: "src/lib/workflowState.ts:20",
      description: "Journey state for engagement document follow-up.",
    },
    {
      category: "Decision states",
      name: "DRIVING_MEETING_BOOKING_DECISION_STATE",
      value: "driving_meeting_booking",
      fileLine: "src/lib/workflowState.ts:21",
      description: "Journey state for advice meeting booking follow-up.",
    },
    {
      category: "Decision states",
      name: "DRIVING_ADVICE_PREP_DECISION_STATE",
      value: "driving_advice_prep",
      fileLine: "src/lib/workflowState.ts:22",
      description: "Journey state for advice preparation visibility.",
    },
    {
      category: "Decision states",
      name: "DRIVING_ADVICE_DELIVERY_DECISION_STATE",
      value: "driving_advice_delivery",
      fileLine: "src/lib/workflowState.ts:23",
      description: "Journey state for SoA delivery follow-up.",
    },
    {
      category: "Decision states",
      name: "DRIVING_AUTHORITY_SIGNATURE_DECISION_STATE",
      value: "driving_authority_signature",
      fileLine: "src/lib/workflowState.ts:24",
      description: "Journey state for authority-to-proceed signature follow-up.",
    },
    {
      category: "Decision states",
      name: "PAUSED_DECISION_STATE",
      value: "paused",
      fileLine: "src/lib/workflowState.ts:25",
      description: "Paused Journey state.",
    },
    {
      category: "Time windows",
      name: "INITIAL_CONTACT_MEETING_DURATION_MS",
      value: "900000",
      fileLine: "src/lib/workflowState.ts:26",
      description: "Initial contact meeting duration, 15 minutes.",
    },
    {
      category: "Time windows",
      name: "OUTCOME_READY_BUFFER_MS",
      value: "3600000",
      fileLine: "src/lib/workflowState.ts:27",
      description: "Post-event buffer before outcome controls become ready, 60 minutes.",
    },
    {
      category: "Time windows",
      name: "ADVICE_MEETING_DURATION_MS",
      value: "4500000",
      fileLine: "src/lib/workflowState.ts:28",
      description: "Advice meeting duration, 75 minutes.",
    },
    {
      category: "Time windows",
      name: "DAY_MS",
      value: "86400000",
      fileLine: "src/lib/workflowState.ts:33",
      description: "Day duration used by Journey time-window calculations.",
    },
    {
      category: "Traffic-light thresholds",
      name: "ADVICE_PREP_GREEN_DAYS",
      value: "7",
      fileLine: "src/lib/workflowState.ts:29",
      description: "Advice preparation green threshold.",
    },
    {
      category: "Traffic-light thresholds",
      name: "ADVICE_PREP_ORANGE_DAYS",
      value: "11",
      fileLine: "src/lib/workflowState.ts:30",
      description: "Advice preparation orange threshold.",
    },
    {
      category: "Traffic-light thresholds",
      name: "ADVICE_DELIVERY_GREEN_DAYS",
      value: "3",
      fileLine: "src/lib/workflowState.ts:31",
      description: "Advice delivery green threshold.",
    },
    {
      category: "Traffic-light thresholds",
      name: "ADVICE_DELIVERY_ORANGE_DAYS",
      value: "5",
      fileLine: "src/lib/workflowState.ts:32",
      description: "Advice delivery orange threshold.",
    },
    {
      category: "Frontend mirror constants",
      name: "COMPLETED_IMPLEMENTATION_OUTCOME_KEYS",
      value: "completed_with_annual_service, completed_setup_only",
      fileLine: "src/components/clients/ClientJourney.tsx:72",
      description: "Implementation outcomes shown as terminal-positive in the Journey UI.",
    },
    {
      category: "Frontend mirror constants",
      name: "WORKFLOW_PHASE_STAGE_MAP",
      value: "initial_contact, initial_meeting, discovery, engagement, advice, implementation",
      fileLine: "src/components/clients/ClientJourney.tsx:77",
      description: "Frontend phase-to-stage mapping used for Journey display.",
    },
    {
      category: "Driver action keys",
      name: "WORKFLOW_DRIVER_ACTION_KEYS",
      value:
        "send_booking_link, book_in_calendly, send_discovery_booking_link, send_engagement_doc, send_advice_booking_link, record_soa_delivered, manually_mark_authority_signed",
      fileLine: "src/lib/workflow.ts:32",
      description: "Driver actions accepted by the workflow action endpoint.",
    },
    {
      category: "Driver action email templates",
      name: "NO_ANSWER_EMAIL_TEMPLATE_ID",
      value: "no_answer_initial_meeting",
      fileLine: "src/lib/workflow.ts:40",
      description: "Email template used for the no-answer task flow.",
    },
    {
      category: "Driver action email templates",
      name: "CALENDLY_INITIAL_MEETING_BOOKING_LINK_EMAIL_TEMPLATE_ID",
      value: "calendly_initial_meeting_booking_link",
      fileLine: "src/lib/workflow.ts:41",
      description: "Email template for the initial meeting booking link action.",
    },
    {
      category: "Driver action email templates",
      name: "DISCOVERY_BOOKING_LINK_EMAIL_TEMPLATE_ID",
      value: "discovery_booking_link",
      fileLine: "src/lib/workflow.ts:42",
      description: "Email template for the discovery booking link action.",
    },
    {
      category: "Driver action email templates",
      name: "ENGAGEMENT_DOC_EMAIL_TEMPLATE_ID",
      value: "engagement_doc",
      fileLine: "src/lib/workflow.ts:43",
      description: "Email template for the engagement document action.",
    },
    {
      category: "Driver action email templates",
      name: "ADVICE_BOOKING_LINK_EMAIL_TEMPLATE_ID",
      value: "advice_booking_link",
      fileLine: "src/lib/workflow.ts:44",
      description: "Email template for the advice booking link action.",
    },
    {
      category: "Driver action email templates",
      name: "AUTHORITY_TO_PROCEED_EMAIL_TEMPLATE_ID",
      value: "authority_to_proceed",
      fileLine: "src/lib/workflow.ts:45",
      description: "Email template sent after SoA delivery is recorded.",
    },
    {
      category: "Calendly mappings",
      name: "CALENDLY_TEMPLATE_ID_BY_MEETING_TYPE",
      value:
        "INITIAL_MEETING=calendly_initial_meeting, FIFTEEN_MIN_CALL=calendly_fifteen_min_call, GENERAL_MEETING=calendly_general_meeting, ADVICE=calendly_general_meeting, ANNUAL_REVIEW=calendly_annual_review, NINETY_DAY_RECAP=calendly_ninety_day_recap",
      fileLine: "src/lib/calendly-webhook.ts:60",
      description: "Calendly meeting type to confirmation email template mapping.",
    },
    {
      category: "Calendly mappings",
      name: "DISCOVERY_BOOKING_CONFIRMATION_TEMPLATE_ID",
      value: "discovery_booking_confirmation",
      fileLine: "src/lib/calendly-webhook.ts:70",
      description: "Email template used for discovery booking confirmations.",
    },
    {
      category: "Calendly mappings",
      name: "LATER_PHASE_TEMPLATE_KEYS",
      value: "engagement, advice, implementation",
      fileLine: "src/lib/calendly-webhook.ts:72",
      description: "Later-phase workflow keys handled by Calendly lifecycle logic.",
    },
  ]
}
