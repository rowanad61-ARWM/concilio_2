export type LifecycleStage =
  | "prospect"
  | "engagement"
  | "advice"
  | "implementation"
  | "client"
  | "lost"
  | "ceased"

export type ServiceSegment = "transaction" | "cashflow" | "wealth" | "wealth_plus"

export type JourneyTaskSummary = {
  done: number
  total: number
  allComplete: boolean
}

export type JourneyDecisionState = "awaiting_event" | "ready_for_outcome" | "driving_booking" | "paused"

export type JourneyOutcomeCatalogEntry = {
  outcomeKey: string
  outcomeLabel: string
  sortOrder: number
  isTerminalLost: boolean
  nextPhaseKey: string | null
  setsWorkflowStatus: string | null
}

export type JourneyTemplateSummary = {
  id: string
  key: string
  name: string
  phaseOrder: number | null
}

export type JourneyPhaseTarget = {
  key: string
  name: string
  phaseOrder: number
}

export type JourneyScopedInstance = {
  id: string
  engagementId: string
  template: JourneyTemplateSummary
  status: string
  triggerDate: string
  createdAt: string
  completedAt: string | null
}

export type JourneyCurrentInstance = JourneyScopedInstance & {
  taskSummary: JourneyTaskSummary
  decisionState: JourneyDecisionState | null
  awaitingEventEndsAt: string | null
  currentOutcomeKey: string | null
  noAnswerAttempts: number
  lastDriverActionKey: string | null
  lastDriverActionAt: string | null
  outcomeCatalog: JourneyOutcomeCatalogEntry[]
}

export type JourneyPastInstance = JourneyScopedInstance & {
  status: "completed" | "cancelled"
}

export type JourneyClientScope = "party" | "household"

export type ClientJourneyResponse = {
  clientId: string
  clientScope: JourneyClientScope
  lifecycleStage: LifecycleStage | null
  serviceSegment: ServiceSegment | null
  lifecycleStageUpdatedAt: string | null
  currentInstance: JourneyCurrentInstance | null
  pastInstances: JourneyPastInstance[]
  triggerInstances: JourneyScopedInstance[]
  nextPhaseTemplate: JourneyPhaseTarget | null
  availableSkipTargets: JourneyPhaseTarget[]
  mostRecentEngagementId: string | null
}

export type EngagementJourneyEntry = {
  instance: JourneyScopedInstance
  template: JourneyTemplateSummary
}

export type EngagementJourneyResponse = {
  current: EngagementJourneyEntry | null
  completed: EngagementJourneyEntry[]
  triggerInstances: EngagementJourneyEntry[]
  nextPhaseTemplate: JourneyPhaseTarget | null
  availableSkipTargets: JourneyPhaseTarget[]
  lifecycleStage: LifecycleStage | null
  currentPhaseTaskSummary: JourneyTaskSummary | null
  decisionState: JourneyDecisionState
  awaitingEventEndsAt: string | null
  currentOutcomeKey: string | null
  noAnswerAttempts: number
  lastDriverActionKey: string | null
  lastDriverActionAt: string | null
}
