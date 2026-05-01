"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import AddressSectionModal from "@/components/clients/AddressSectionModal"
import ClientJourney from "@/components/clients/ClientJourney"
import ClientTimeline from "@/components/clients/ClientTimeline"
import DeleteClientButton from "@/components/clients/DeleteClientButton"
import ClientEmailTemplateModal from "@/components/clients/ClientEmailTemplateModal"
import DocumentsTab from "@/components/clients/DocumentsTab"
import ContactSectionModal from "@/components/clients/ContactSectionModal"
import DependantDeleteConfirm from "@/components/clients/DependantDeleteConfirm"
import DependantModal from "@/components/clients/DependantModal"
import EmploymentSectionModal from "@/components/clients/EmploymentSectionModal"
import HouseholdSectionModal from "@/components/clients/HouseholdSectionModal"
import PersonalSectionModal from "@/components/clients/PersonalSectionModal"
import QuickAddMeetingModal from "@/components/clients/QuickAddMeetingModal"
import QuickAddNoteModal from "@/components/clients/QuickAddNoteModal"
import QuickAddPhoneCallModal from "@/components/clients/QuickAddPhoneCallModal"
import TaskModal, {
  TASK_STATUS_OPTIONS,
  type EditableTaskEntry,
  type TaskDocumentLinkEntry,
  type TaskOwnerOption,
  type TaskStatusValue,
  type TaskTypeGroup,
} from "@/components/clients/TaskModal"
import { formatCalendlyMeetingDateTime, getCalendlyMeetingTypeLabel } from "@/lib/calendly"
import { ENGAGEMENT_TYPE_VALUES } from "@/lib/engagement"
import { scoreToAllocation, type RiskAllocation } from "@/lib/risk"
import type {
  ClientAddress,
  ClientDetail,
  ClientHouseholdMember,
  TimelineEngagement,
  TimelineNote,
} from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
  notes: TimelineNote[]
}

type TimelineFilter = "all" | "emails" | "tasks" | "notes" | "docs"
type ClientDetailTab = "timeline" | "documents"
type QuickAddKind = "phone_call" | "meeting" | "file_note"
type SectionModalKind = "personal" | "address" | "employment" | "contact" | "household" | null
type DependantModalState =
  | { mode: "create"; member: null }
  | { mode: "edit"; member: ClientHouseholdMember }
  | null
type EngagementType = (typeof ENGAGEMENT_TYPE_VALUES)[number]
type LifecycleStage = "prospect" | "engagement" | "advice" | "implementation" | "client" | "lost" | "ceased"
type ServiceTier = "transaction" | "cashflow" | "wealth" | "wealth_plus"
type VerificationResult = "pass" | "pending" | "fail"
type VerificationDocumentType = "passport" | "drivers_licence" | "medicare_card" | "birth_certificate" | "other"
type VerificationCheck = ClientDetail["verificationChecks"][number]
type StatusTone = "green" | "amber" | "red" | "muted"
type HeaderIndicator = {
  label: string
  value: string
  tone: StatusTone
  icon: React.ReactNode
}
type IncomeFrequency = "weekly" | "fortnightly" | "monthly" | "annual"
type LiabilityRepaymentFrequency = "weekly" | "fortnightly" | "monthly"
type CapacityForLoss = "low" | "medium" | "high"

type AddIdFormState = {
  documentType: VerificationDocumentType
  documentReference: string
  expiryDate: string
  result: VerificationResult
  notes: string
}

type EngagementFormState = {
  title: string
  engagementType: EngagementType
  templateId: string
  description: string
}

type WorkflowTemplateOption = {
  id: string
  name: string
}

type IncomeItem = {
  id: string
  incomeType: string
  description: string | null
  amount: number
  frequency: string
  isGross: boolean
}

type IncomeFormState = {
  incomeType: string
  description: string
  amount: string
  frequency: IncomeFrequency
  isGross: boolean
}

type PropertyAssetItem = {
  id: string
  address: {
    line1: string | null
    suburb: string | null
    state: string | null
    postcode: string | null
  }
  usageType: string | null
  currentValue: number
}

type FinancialAccountItem = {
  id: string
  accountType: string
  currentBalance: number
  institutionName: string | null
}

type LiabilityItem = {
  id: string
  liabilityType: string
  description: string | null
  currentBalance: number
  interestRate: number | null
  repaymentAmount: number | null
  repaymentFrequency: string | null
}

type EmailLogEntry = {
  id: string
  sentAt: string
  subject: string
  sentBy: string
  status: string
  body: string
}

type EmailToastState = {
  kind: "success" | "error" | "warning"
  message: string
}

type TaskEntry = EditableTaskEntry & {
  clientId: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  linkedDocumentCount: number
  noteCount: number
}

type TaskLinkedDocument = {
  id: string
  taskId: string
  sharepointDriveItemId: string
  fileName: string
  folder: string
  createdAt: string
  webUrl: string | null
  downloadUrl: string | null
  lastModifiedDateTime: string | null
  size: number | null
  existsInSharePoint: boolean
}

type TaskNoteEntry = {
  id: string
  body: string
  source: "CONCILIO" | "MONDAY" | "SYSTEM"
  createdAt: string
  author: {
    id: string
    fullName: string
    email: string
  } | null
}

type PropertyFormState = {
  usageType: string
  currentValue: string
  addressLine1: string
  suburb: string
  state: string
  postcode: string
}

type AccountFormState = {
  accountType: string
  currentBalance: string
  institutionName: string
}

type LiabilityFormState = {
  liabilityType: string
  description: string
  currentBalance: string
  interestRate: string
  repaymentAmount: string
  repaymentFrequency: LiabilityRepaymentFrequency
}

type RiskProfileFormState = {
  score: string
  capacityForLoss: CapacityForLoss
  validUntil: string
  overrideFlag: boolean
  overrideAllocation: RiskAllocation
  overrideReason: string
}

const timelineFilters: { label: string; value: TimelineFilter }[] = [
  { label: "All", value: "all" },
  { label: "Emails", value: "emails" },
  { label: "Tasks", value: "tasks" },
  { label: "Notes", value: "notes" },
  { label: "Docs", value: "docs" },
]

const incomeTypeOptions = [
  "salary",
  "pension_super",
  "pension_government",
  "rental",
  "dividends",
  "interest",
  "business",
  "centrelink",
  "other",
]
const propertyUsageOptions = ["owner_occupied", "investment", "holiday", "commercial", "rural", "other"]
const accountTypeOptions = [
  "bank",
  "term_deposit",
  "wrap_platform",
  "super_accumulation",
  "super_pension",
  "direct_shares",
  "managed_fund",
  "insurance",
  "loan",
  "credit_card",
  "other",
]
const liabilityTypeOptions = [
  "home_loan",
  "investment_loan",
  "personal_loan",
  "car_loan",
  "credit_card",
  "margin_loan",
  "business_loan",
  "other",
]
const liabilityRepaymentFrequencyOptions: { label: string; value: LiabilityRepaymentFrequency }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Fortnightly", value: "fortnightly" },
  { label: "Monthly", value: "monthly" },
]
const riskAllocationOptions: RiskAllocation[] = ["30/70", "40/60", "50/50", "60/40", "70/30", "80/20", "100"]
const capacityForLossOptions: { label: string; value: CapacityForLoss }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
]
const incomeFrequencyOptions: { label: string; value: IncomeFrequency }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Fortnightly", value: "fortnightly" },
  { label: "Monthly", value: "monthly" },
  { label: "Annual", value: "annual" },
]
const lifecycleStageOptions: { label: string; value: LifecycleStage }[] = [
  { label: "Prospect", value: "prospect" },
  { label: "Engagement", value: "engagement" },
  { label: "Advice", value: "advice" },
  { label: "Implementation", value: "implementation" },
  { label: "Client", value: "client" },
  { label: "Lost", value: "lost" },
  { label: "Ceased", value: "ceased" },
]
const serviceTierOptions: { label: string; value: ServiceTier | null }[] = [
  { label: "None", value: null },
  { label: "Transaction", value: "transaction" },
  { label: "Cashflow Manager", value: "cashflow" },
  { label: "Wealth Manager", value: "wealth" },
  { label: "Wealth Manager+", value: "wealth_plus" },
]
const verificationDocumentTypeOptions: { label: string; value: VerificationDocumentType }[] = [
  { label: "Passport", value: "passport" },
  { label: "Driver's Licence", value: "drivers_licence" },
  { label: "Medicare Card", value: "medicare_card" },
  { label: "Birth Certificate", value: "birth_certificate" },
  { label: "Other", value: "other" },
]
const verificationResultOptions: { label: string; value: VerificationResult }[] = [
  { label: "Pass", value: "pass" },
  { label: "Pending", value: "pending" },
  { label: "Fail", value: "fail" },
]

const inputClassName =
  "w-full rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[8px] py-[6px] text-[13px] text-[#113238] outline-none"

function buildAddIdForm(): AddIdFormState {
  return {
    documentType: "passport",
    documentReference: "",
    expiryDate: "",
    result: "pending",
    notes: "",
  }
}

function buildEngagementForm(): EngagementFormState {
  return {
    title: "",
    engagementType: ENGAGEMENT_TYPE_VALUES[0],
    templateId: "",
    description: "",
  }
}

function buildIncomeForm(): IncomeFormState {
  return {
    incomeType: "salary",
    description: "",
    amount: "",
    frequency: "monthly",
    isGross: true,
  }
}

function buildPropertyForm(): PropertyFormState {
  return {
    usageType: "owner_occupied",
    currentValue: "",
    addressLine1: "",
    suburb: "",
    state: "",
    postcode: "",
  }
}

function buildAccountForm(): AccountFormState {
  return {
    accountType: "bank",
    currentBalance: "",
    institutionName: "",
  }
}

function buildLiabilityForm(): LiabilityFormState {
  return {
    liabilityType: "home_loan",
    description: "",
    currentBalance: "",
    interestRate: "",
    repaymentAmount: "",
    repaymentFrequency: "monthly",
  }
}

function buildRiskProfileForm(): RiskProfileFormState {
  return {
    score: "",
    capacityForLoss: "medium",
    validUntil: "",
    overrideFlag: false,
    overrideAllocation: "50/50",
    overrideReason: "",
  }
}

function formatAddressLines(address: ClientAddress | null): string[] {
  if (!address) {
    return []
  }

  const line1 = address.line1?.trim() ?? ""
  const line2 = address.line2?.trim() ?? ""
  const suburb = address.suburb?.trim() ?? ""
  const state = address.state?.trim() ?? ""
  const postcode = address.postcode?.trim() ?? ""
  const country = address.country?.trim().toUpperCase() ?? ""

  const lines: string[] = []
  if (line1) {
    lines.push(line1)
  }
  if (line2) {
    lines.push(line2)
  }

  const suburbStatePostcode = [suburb, state, postcode].filter(Boolean).join(" ")
  if (suburbStatePostcode) {
    lines.push(suburbStatePostcode)
  }

  if (country && country !== "AU") {
    lines.push(country)
  }

  return lines
}

function addressesEqual(first: ClientAddress | null, second: ClientAddress | null) {
  if (!first || !second) {
    return false
  }

  return (
    (first.line1 ?? "") === (second.line1 ?? "") &&
    (first.line2 ?? "") === (second.line2 ?? "") &&
    (first.suburb ?? "") === (second.suburb ?? "") &&
    (first.state ?? "") === (second.state ?? "") &&
    (first.postcode ?? "") === (second.postcode ?? "") &&
    ((first.country ?? "AU").toUpperCase() === (second.country ?? "AU").toUpperCase())
  )
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not provided"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatVerificationResult(value: string): VerificationResult {
  const normalized = value.toLowerCase()

  if (normalized === "pass" || normalized === "verified") {
    return "pass"
  }

  if (normalized === "fail" || normalized === "failed" || normalized === "expired") {
    return "fail"
  }

  return "pending"
}

function getVerificationResultBadgeClasses(result: VerificationResult) {
  switch (result) {
    case "pass":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    case "fail":
      return "bg-[#FCE8E8] text-[#E24B4A]"
    default:
      return "bg-[#F3F4F6] text-[#6B7280]"
  }
}

function formatDocumentType(value: string | null) {
  if (!value) {
    return "ID Document"
  }

  const normalized = value.toLowerCase()
  switch (normalized) {
    case "passport":
      return "Passport"
    case "drivers_licence":
      return "Driver's Licence"
    case "medicare_card":
      return "Medicare Card"
    case "birth_certificate":
      return "Birth Certificate"
    case "other":
      return "Other"
    default:
      return formatCategory(value)
  }
}

function getExpiryState(value: string | null) {
  if (!value) {
    return "none"
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return "none"
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiryDate = new Date(parsedDate)
  expiryDate.setHours(0, 0, 0, 0)

  if (expiryDate < today) {
    return "expired"
  }

  const sixtyDaysFromNow = new Date(today)
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

  if (expiryDate <= sixtyDaysFromNow) {
    return "dueSoon"
  }

  return "active"
}

function getExpiryTextClass(expiryState: string) {
  switch (expiryState) {
    case "expired":
      return "text-[#E24B4A]"
    case "dueSoon":
      return "text-[#FF8C42]"
    default:
      return "text-[#113238]"
  }
}

function getHeaderPillClasses(tone: StatusTone) {
  switch (tone) {
    case "green":
      return "border-[#B8DCCB] bg-[#E6F0EC] text-[#0F5C3A]"
    case "amber":
      return "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
    case "red":
      return "border-[#F9CACA] bg-[#FCE8E8] text-[#B42318]"
    default:
      return "border-[#e5e7eb] bg-[#F3F4F6] text-[#6B7280]"
  }
}

function getIdDocumentIndicator(checks: VerificationCheck[]): HeaderIndicator {
  if (checks.length === 0) {
    return {
      label: "ID",
      value: "Missing",
      tone: "red",
      icon: <IdIcon />,
    }
  }

  const passedChecks = checks.filter((check) => formatVerificationResult(check.result) === "pass")
  if (passedChecks.length === 0) {
    return {
      label: "ID",
      value: "Missing",
      tone: "red",
      icon: <IdIcon />,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const datedChecks = passedChecks
    .map((check) => {
      if (!check.expiryDate) {
        return { check, expiry: null }
      }

      const expiry = new Date(check.expiryDate)
      expiry.setHours(0, 0, 0, 0)
      return Number.isNaN(expiry.getTime()) ? { check, expiry: null } : { check, expiry }
    })
    .sort((left, right) => {
      const leftTime = left.expiry?.getTime() ?? Number.MAX_SAFE_INTEGER
      const rightTime = right.expiry?.getTime() ?? Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })

  const earliest = datedChecks[0]
  if (earliest?.expiry && earliest.expiry < today) {
    return {
      label: "ID",
      value: "Expired",
      tone: "red",
      icon: <IdIcon />,
    }
  }

  if (earliest?.expiry && earliest.expiry <= thirtyDaysFromNow) {
    return {
      label: "ID",
      value: "Expiring",
      tone: "amber",
      icon: <IdIcon />,
    }
  }

  return {
    label: "ID",
    value: "Current",
    tone: "green",
    icon: <IdIcon />,
  }
}

function getAuthorityIndicator(): HeaderIndicator {
  return {
    label: "Authority",
    value: "Missing",
    tone: "red",
    icon: <AuthorityIcon />,
  }
}

function getNextEngagementIndicator(engagements: TimelineEngagement[]): HeaderIndicator | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextEngagement = engagements
    .map((engagement) => {
      const candidateDate = engagement.openedAt ?? engagement.startedAt
      const parsed = candidateDate ? new Date(candidateDate) : null
      return parsed && !Number.isNaN(parsed.getTime()) ? { engagement, parsed } : null
    })
    .filter((item): item is { engagement: TimelineEngagement; parsed: Date } => Boolean(item))
    .filter((item) => item.parsed >= today)
    .sort((left, right) => left.parsed.getTime() - right.parsed.getTime())[0]

  if (!nextEngagement) {
    return null
  }

  return {
    label: nextEngagement.engagement.source?.toUpperCase() === "CALENDLY" ? "Next meeting" : "Next review",
    value: formatDate(nextEngagement.parsed.toISOString()),
    tone: "muted",
    icon: <CalendarIcon />,
  }
}

function formatTimelineTimestamp(value: string) {
  if (value === "just-now") {
    return "Just now"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatExactDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time"
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function formatRelativeDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time"
  }

  const nowMs = Date.now()
  const diffMs = parsed.getTime() - nowMs
  const diffAbsMs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (diffAbsMs < 60_000) {
    return rtf.format(Math.round(diffMs / 1000), "second")
  }

  if (diffAbsMs < 3_600_000) {
    return rtf.format(Math.round(diffMs / 60_000), "minute")
  }

  if (diffAbsMs < 86_400_000) {
    return rtf.format(Math.round(diffMs / 3_600_000), "hour")
  }

  if (diffAbsMs < 2_592_000_000) {
    return rtf.format(Math.round(diffMs / 86_400_000), "day")
  }

  return formatExactDateTime(value)
}

function getTaskNoteSourceLabel(source: TaskNoteEntry["source"]) {
  if (source === "MONDAY") {
    return "Monday"
  }

  if (source === "SYSTEM") {
    return "System"
  }

  return "Concilio"
}

function getTaskNoteSourceClasses(source: TaskNoteEntry["source"]) {
  if (source === "MONDAY") {
    return "bg-[#E6F1FB] text-[#185FA5]"
  }

  if (source === "SYSTEM") {
    return "bg-[#F3F4F6] text-[#6B7280]"
  }

  return "bg-[#E6F0EC] text-[#0F5C3A]"
}

function getTaskNoteAuthorLabel(note: TaskNoteEntry) {
  if (note.source === "SYSTEM") {
    return "System"
  }

  if (note.author?.fullName?.trim()) {
    return note.author.fullName
  }

  if (note.source === "MONDAY") {
    return "Monday"
  }

  return "Unknown"
}

function renderTaskNoteBody(body: string) {
  const parts = body.split(/(@[A-Za-z0-9._-]+)/g)

  return parts.map((part, index) => {
    if (/^@[A-Za-z0-9._-]+$/.test(part)) {
      return (
        <span key={`mention-${index}`} className="font-medium text-[#185FA5]">
          {part}
        </span>
      )
    }

    return <span key={`text-${index}`}>{part}</span>
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value)
}

function getWorkflowStageState(index: number, currentIndex: number, workflowStatus: string) {
  if (workflowStatus === "completed") {
    return "completed"
  }

  if (index < currentIndex) {
    return "completed"
  }

  if (index === currentIndex) {
    return "current"
  }

  return "upcoming"
}

function getWorkflowStageClasses(state: string) {
  switch (state) {
    case "completed":
      return "border-[#113238] bg-[#113238]"
    case "current":
      return "border-[#FF8C42] bg-[#FF8C42]"
    default:
      return "border-[#e5e7eb] bg-white"
  }
}

function getTimelineSortValue(value: string) {
  if (value === "just-now") {
    return Number.MAX_SAFE_INTEGER
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "open":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    case "in_progress":
      return "bg-[#E6F1FB] text-[#185FA5]"
    case "completed":
    case "implemented":
      return "bg-[#EAF0F1] text-[#113238]"
    case "cancelled":
      return "bg-[#FCE8E8] text-[#E24B4A]"
    default:
      return "bg-[#F3F4F6] text-[#6B7280]"
  }
}

function getEmailLogStatusClasses(status: string) {
  return status.toLowerCase() === "sent"
    ? "bg-[#E6F0EC] text-[#0F5C3A]"
    : "bg-[#FCE8E8] text-[#E24B4A]"
}

function getTaskStatusClasses(status: TaskStatusValue) {
  if (status === "DONE") {
    return "bg-[#E6F0EC] text-[#0F5C3A]"
  }

  if (status === "CANCELLED") {
    return "bg-[#FCE8E8] text-[#E24B4A]"
  }

  if (status === "STUCK" || status === "ON_HOLD") {
    return "bg-[#FEF3C7] text-[#92400E]"
  }

  return "bg-[#E6F1FB] text-[#185FA5]"
}

function getTaskStatusLabel(status: TaskStatusValue) {
  return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

function formatTaskDueDateLabel(start: string | null, end: string | null) {
  if (!start) {
    return null
  }

  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) {
    return null
  }

  if (!end) {
    return `Due ${new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(startDate)}`
  }

  const endDate = new Date(end)
  if (Number.isNaN(endDate.getTime())) {
    return null
  }

  const startLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(startDate)
  const endLabel = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(endDate)

  return `${startLabel} - ${endLabel}`
}

function formatRecurrenceCadence(value: EditableTaskEntry["recurrenceCadence"]) {
  if (!value) {
    return null
  }

  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}

function getOwnerInitials(fullName: string) {
  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function formatCategory(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatIncomeFrequency(value: string) {
  if (value === "annually" || value === "annual") {
    return "Annual"
  }

  return formatCategory(value)
}

function formatAddressSummary(address: {
  line1: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
}) {
  const parts = [address.line1, [address.suburb, address.state, address.postcode].filter(Boolean).join(" ")]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)

  return parts.length > 0 ? parts.join(", ") : "Address unavailable"
}

function formatClassificationValue(value: string) {
  if (value === "wealth_plus") {
    return "Wealth Manager+"
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatHouseholdRole(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatHouseholdRelation(value: string | null) {
  if (!value) {
    return "Not provided"
  }

  return formatCategory(value)
}

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) {
    return null
  }

  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function truncateText(value: string | null, maxLength = 120) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1).trim()}...`
}

function getClassificationClasses(value: string) {
  switch (value) {
    case "wealth_plus":
      return "bg-[#FEF0E7] text-[#C45F1A]"
    case "wealth":
      return "bg-[#EAF0F1] text-[#113238]"
    case "cashflow":
      return "bg-[#E6F0EC] text-[#0F5C3A]"
    case "transaction":
      return "bg-[#E6F1FB] text-[#185FA5]"
    default:
      return "bg-[#F3F4F6] text-[#6B7280]"
  }
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div>
      <p className="mb-[2px] text-[10px] text-[#9ca3af]">{label}</p>
      <p className="text-[13px] leading-[1.5] text-[#113238]">
        {value && value.trim() ? value : "Not provided"}
      </p>
    </div>
  )
}

function EditField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="mb-[2px] block text-[10px] text-[#9ca3af]">{label}</span>
      {children}
    </label>
  )
}

function HeaderStatusPill({ indicator }: { indicator: HeaderIndicator }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-[999px] border-[0.5px] px-[8px] py-[3px] text-[11px] ${getHeaderPillClasses(indicator.tone)}`}
    >
      {indicator.icon}
      <span className="font-medium">{indicator.label}</span>
      <span>{indicator.value}</span>
    </span>
  )
}

function ExpandableSection({
  title,
  action,
  className = "",
  children,
}: {
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className={`border-b-[0.5px] border-[#e5e7eb] bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex min-h-[42px] flex-1 items-center justify-between gap-3 py-[12px] text-left"
          aria-expanded={isOpen}
        >
          <span className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">{title}</span>
          <ChevronIcon isOpen={isOpen} />
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-3.5 w-3.5 shrink-0 text-[#9ca3af] transition-transform duration-200 ${
        isOpen ? "rotate-180" : ""
      }`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HeaderMiniIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      {children}
    </svg>
  )
}

function PhoneIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M5.2 2.5 6.4 5c.2.4.1.9-.2 1.2l-.7.7a8 8 0 0 0 3.6 3.6l.7-.7c.3-.3.8-.4 1.2-.2l2.5 1.2c.5.2.8.7.7 1.2l-.2 1.2c-.1.5-.5.8-1 .8A11 11 0 0 1 2 3c0-.5.3-.9.8-1l1.2-.2c.5-.1 1 .2 1.2.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function MeetingIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M3 5.5h10M5 2.5v2m6-2v2M3.5 3.5h9A1.5 1.5 0 0 1 14 5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V5a1.5 1.5 0 0 1 1.5-1.5Zm2 5h2m2 0h2m-6 2.5h2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function NoteHeaderIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M5 2.5h4l2 2v7A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-7A1.5 1.5 0 0 1 5.5 3H9m0-.5V5h2.5M6 8h4M6 10.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function IdIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M3 4h10v8H3V4Zm2.5 5.5h2m2-3h2m-2 2h2M5.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-1.8 3a2 2 0 0 1 3.6 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function AuthorityIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M8 2.5 12.5 4v3.5c0 2.8-1.8 5-4.5 6-2.7-1-4.5-3.2-4.5-6V4L8 2.5Zm-2 5 1.4 1.4L10.3 6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function CalendarIcon() {
  return (
    <HeaderMiniIcon>
      <path
        d="M3.5 3.5h9A1.5 1.5 0 0 1 14 5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V5a1.5 1.5 0 0 1 1.5-1.5Zm.5 3h8M5.5 2.5v2m5-2v2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HeaderMiniIcon>
  )
}

function NoteIcon() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#FEF0E7] text-[#C45F1A]">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M5 2.5h4l2 2v7A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-7A1.5 1.5 0 0 1 5.5 3H9m0-.5V5h2.5M6 8h4M6 10.5h3"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function EngagementIcon() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#E6F1FB] text-[#185FA5]">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M3.5 4.5h9m-9 3h9m-9 3h5m-7-7.5A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function EmailIcon() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#EAF0F1] text-[#113238]">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M2.5 4.5h11A1.5 1.5 0 0 1 15 6v4A1.5 1.5 0 0 1 13.5 11.5h-11A1.5 1.5 0 0 1 1 10V6a1.5 1.5 0 0 1 1.5-1.5zm0 0L8 8.5l5.5-4"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function TaskIcon() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#E6F0EC] text-[#0F5C3A]">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
        <path
          d="M4 3.5h8M4 7.5h8M4 11.5h5M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default function ClientRecord({ client }: ClientRecordProps) {
  const router = useRouter()
  const [clientData, setClientData] = useState(client)
  const [activeDetailTab, setActiveDetailTab] = useState<ClientDetailTab>("timeline")
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>(client.verificationChecks)
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all")
  const [quickAddOpen, setQuickAddOpen] = useState<QuickAddKind | null>(null)
  const [openSectionModal, setOpenSectionModal] = useState<SectionModalKind>(null)
  const [dependantModalState, setDependantModalState] = useState<DependantModalState>(null)
  const [dependantDeleteTarget, setDependantDeleteTarget] = useState<ClientHouseholdMember | null>(null)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [isEngagementPanelOpen, setIsEngagementPanelOpen] = useState(false)
  const [isSavingEngagement, setIsSavingEngagement] = useState(false)
  const [isSavingIncome, setIsSavingIncome] = useState(false)
  const [isSavingProperty, setIsSavingProperty] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isSavingLiability, setIsSavingLiability] = useState(false)
  const [isSavingRiskProfile, setIsSavingRiskProfile] = useState(false)
  const [localEngagements, setLocalEngagements] = useState<TimelineEngagement[]>(client.engagements)
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([])
  const [isIncomeDrawerOpen, setIsIncomeDrawerOpen] = useState(false)
  const [isLoadingIncome, setIsLoadingIncome] = useState(false)
  const [isAddIncomeFormOpen, setIsAddIncomeFormOpen] = useState(false)
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(() => buildIncomeForm())
  const [isAssetsDrawerOpen, setIsAssetsDrawerOpen] = useState(false)
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [propertyAssets, setPropertyAssets] = useState<PropertyAssetItem[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountItem[]>([])
  const [isAddPropertyFormOpen, setIsAddPropertyFormOpen] = useState(false)
  const [isAddAccountFormOpen, setIsAddAccountFormOpen] = useState(false)
  const [propertyForm, setPropertyForm] = useState<PropertyFormState>(() => buildPropertyForm())
  const [accountForm, setAccountForm] = useState<AccountFormState>(() => buildAccountForm())
  const [isLiabilitiesDrawerOpen, setIsLiabilitiesDrawerOpen] = useState(false)
  const [isEmailTemplateModalOpen, setIsEmailTemplateModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<"create" | "edit">("create")
  const [editingTask, setEditingTask] = useState<TaskEntry | null>(null)
  const [isLoadingLiabilities, setIsLoadingLiabilities] = useState(false)
  const [liabilityItems, setLiabilityItems] = useState<LiabilityItem[]>([])
  const [isAddLiabilityFormOpen, setIsAddLiabilityFormOpen] = useState(false)
  const [liabilityForm, setLiabilityForm] = useState<LiabilityFormState>(() => buildLiabilityForm())
  const [isAddRiskProfileFormOpen, setIsAddRiskProfileFormOpen] = useState(false)
  const [riskProfileForm, setRiskProfileForm] = useState<RiskProfileFormState>(() => buildRiskProfileForm())
  const [engagementForm, setEngagementForm] = useState<EngagementFormState>(() => buildEngagementForm())
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateOption[]>([])
  const [isLoadingWorkflowTemplates, setIsLoadingWorkflowTemplates] = useState(false)
  const [isLinkingHousehold, setIsLinkingHousehold] = useState(false)
  const [householdNameInput, setHouseholdNameInput] = useState("")
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false)
  const [isLifecycleMenuOpen, setIsLifecycleMenuOpen] = useState(false)
  const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false)
  const [isServiceTierMenuOpen, setIsServiceTierMenuOpen] = useState(false)
  const [isUpdatingServiceTier, setIsUpdatingServiceTier] = useState(false)
  const [isAddIdFormOpen, setIsAddIdFormOpen] = useState(false)
  const [isSavingIdVerification, setIsSavingIdVerification] = useState(false)
  const [addIdForm, setAddIdForm] = useState<AddIdFormState>(() => buildAddIdForm())
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([])
  const [isLoadingEmailLogs, setIsLoadingEmailLogs] = useState(false)
  const [expandedEmailLogId, setExpandedEmailLogId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [isLoadingTaskDocumentsForId, setIsLoadingTaskDocumentsForId] = useState<string | null>(null)
  const [taskDocumentsByTaskId, setTaskDocumentsByTaskId] = useState<Record<string, TaskLinkedDocument[]>>({})
  const [isLoadingTaskNotesForId, setIsLoadingTaskNotesForId] = useState<string | null>(null)
  const [taskNotesByTaskId, setTaskNotesByTaskId] = useState<Record<string, TaskNoteEntry[]>>({})
  const [taskTypeOptions, setTaskTypeOptions] = useState<TaskTypeGroup[]>([])
  const [ownerOptions, setOwnerOptions] = useState<TaskOwnerOption[]>([])
  const [emailToast, setEmailToast] = useState<EmailToastState | null>(null)

  useEffect(() => {
    setClientData(client)
    setVerificationChecks(client.verificationChecks)
    setLocalEngagements(client.engagements)
  }, [client])

  const fullLegalName = clientData.person
    ? `${clientData.person.legalGivenName} ${clientData.person.legalFamilyName}`.trim()
    : null

  const visibleEngagements = activeFilter === "all" ? localEngagements : []
  const visibleEmails = activeFilter === "all" || activeFilter === "emails" ? emailLogs : []
  const visibleTasks = activeFilter === "all" || activeFilter === "tasks" ? tasks : []
  const timelineItems = [
    ...visibleEngagements.map((engagement) => ({
      kind: "engagement" as const,
      id: `engagement-${engagement.id}`,
      timestamp: engagement.startedAt,
      engagement,
    })),
    ...visibleEmails.map((log) => ({
      kind: "email" as const,
      id: `email-${log.id}`,
      timestamp: log.sentAt,
      emailLog: log,
    })),
    ...visibleTasks.map((task) => ({
      kind: "task" as const,
      id: `task-${task.id}`,
      timestamp: task.createdAt,
      task,
    })),
  ].sort((left, right) => getTimelineSortValue(right.timestamp) - getTimelineSortValue(left.timestamp))
  const isTimelineLoading =
    (isLoadingEmailLogs && (activeFilter === "all" || activeFilter === "emails")) ||
    (isLoadingTasks && (activeFilter === "all" || activeFilter === "tasks"))
  const activeHouseholdMembers = clientData.household?.members.filter((member) => !member.endDate) ?? []
  const adultHouseholdMembers = activeHouseholdMembers.filter((member) => member.role !== "dependant")
  const dependantHouseholdMembers = activeHouseholdMembers.filter((member) => member.role === "dependant")
  const householdAdultMembers = adultHouseholdMembers.map((member) => ({
    id: member.id,
    displayName: member.displayName,
  }))
  const journeyClientScope = clientData.household?.id ? "household" : "party"
  const journeyClientId = journeyClientScope === "household" ? clientData.household!.id : clientData.id
  const lifecycleStage = clientData.classification?.lifecycleStage ?? null
  const serviceTier = clientData.classification?.serviceTier ?? null
  const residentialAddress = clientData.person?.addressResidential ?? null
  const postalAddress = clientData.person?.addressPostal ?? null
  const residentialAddressLines = formatAddressLines(residentialAddress)
  const postalAddressLines = formatAddressLines(postalAddress)
  const showPostalAddress = postalAddressLines.length > 0 && !addressesEqual(residentialAddress, postalAddress)
  const hasEmergencyContact = Boolean(
    clientData.person?.emergencyContactName ||
      clientData.person?.emergencyContactRelationship ||
      clientData.person?.emergencyContactPhone ||
      clientData.person?.emergencyContactEmail ||
      clientData.person?.emergencyContactNotes,
  )
  const riskScoreValue = Number(riskProfileForm.score)
  const recommendedAllocation =
    Number.isFinite(riskScoreValue) && riskScoreValue >= 0 && riskScoreValue <= 100
      ? scoreToAllocation(riskScoreValue)
      : null
  const idDocumentIndicator = getIdDocumentIndicator(verificationChecks)
  const authorityIndicator = getAuthorityIndicator()
  const nextEngagementIndicator = getNextEngagementIndicator(localEngagements)
  const headerIndicators = [
    idDocumentIndicator,
    authorityIndicator,
    ...(nextEngagementIndicator ? [nextEngagementIndicator] : []),
  ]

  const loadEmailLogs = useCallback(async () => {
    setIsLoadingEmailLogs(true)

    try {
      const params = new URLSearchParams({
        clientId: clientData.id,
      })
      if (clientData.household?.id) {
        params.set("householdId", clientData.household.id)
      }

      const response = await fetch(`/api/email/logs?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to load email logs")
      }

      const payload = (await response.json()) as { logs?: unknown[] }
      const rawLogs = Array.isArray(payload.logs) ? payload.logs : []

      setEmailLogs(
        rawLogs
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null
            }

            const value = item as Record<string, unknown>
            if (
              typeof value.id !== "string" ||
              typeof value.subject !== "string" ||
              typeof value.sentAt !== "string" ||
              typeof value.sentBy !== "string" ||
              typeof value.status !== "string" ||
              typeof value.body !== "string"
            ) {
              return null
            }

            return {
              id: value.id,
              subject: value.subject,
              sentAt: value.sentAt,
              sentBy: value.sentBy,
              status: value.status,
              body: value.body,
            }
          })
          .filter((item): item is EmailLogEntry => Boolean(item)),
      )
    } catch (error) {
      console.error(error)
      setEmailToast({ kind: "error", message: "Failed to load email history" })
    } finally {
      setIsLoadingEmailLogs(false)
    }
  }, [clientData.household?.id, clientData.id])

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true)

    try {
      const response = await fetch(`/api/tasks?clientId=${encodeURIComponent(clientData.id)}`)
      if (!response.ok) {
        throw new Error("Failed to load tasks")
      }

      const payload = (await response.json()) as { tasks?: unknown[] }
      const rawTasks = Array.isArray(payload.tasks) ? payload.tasks : []
      setTaskDocumentsByTaskId({})
      setIsLoadingTaskDocumentsForId(null)
      setTaskNotesByTaskId({})
      setIsLoadingTaskNotesForId(null)

      const parsedTasks = rawTasks
        .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null
            }

            const value = item as Record<string, unknown>
            if (
              typeof value.id !== "string" ||
              typeof value.clientId !== "string" ||
              typeof value.title !== "string" ||
              typeof value.type !== "string" ||
              typeof value.status !== "string" ||
              typeof value.createdAt !== "string" ||
              typeof value.updatedAt !== "string"
            ) {
              return null
            }

            if (!TASK_STATUS_OPTIONS.some((option) => option.value === value.status)) {
              return null
            }

            const rawOwners = Array.isArray(value.owners) ? value.owners : []
            const owners = rawOwners
              .map((owner): TaskOwnerOption | null => {
                if (!owner || typeof owner !== "object" || Array.isArray(owner)) {
                  return null
                }

                const ownerValue = owner as Record<string, unknown>
                if (
                  typeof ownerValue.id !== "string" ||
                  typeof ownerValue.fullName !== "string" ||
                  typeof ownerValue.email !== "string"
                ) {
                  return null
                }

                return {
                  id: ownerValue.id,
                  fullName: ownerValue.fullName,
                  email: ownerValue.email,
                }
              })
              .filter((owner): owner is TaskOwnerOption => Boolean(owner))

            const rawLinks = Array.isArray(value.documentLinks) ? value.documentLinks : []
            const documentLinks = rawLinks
              .map((documentLink): TaskDocumentLinkEntry | null => {
                if (!documentLink || typeof documentLink !== "object" || Array.isArray(documentLink)) {
                  return null
                }

                const linkValue = documentLink as Record<string, unknown>
                if (
                  typeof linkValue.id !== "string" ||
                  typeof linkValue.sharepointDriveItemId !== "string" ||
                  typeof linkValue.fileName !== "string" ||
                  typeof linkValue.folder !== "string" ||
                  typeof linkValue.createdAt !== "string"
                ) {
                  return null
                }

                return {
                  id: linkValue.id,
                  sharepointDriveItemId: linkValue.sharepointDriveItemId,
                  fileName: linkValue.fileName,
                  folder: linkValue.folder,
                  createdAt: linkValue.createdAt,
                }
              })
              .filter((documentLink): documentLink is TaskDocumentLinkEntry => Boolean(documentLink))

            const recurrenceCadence =
              typeof value.recurrenceCadence === "string" &&
              ["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"].includes(value.recurrenceCadence)
                ? (value.recurrenceCadence as EditableTaskEntry["recurrenceCadence"])
                : null

            const parsedTask: TaskEntry = {
              id: value.id,
              clientId: value.clientId,
              title: value.title,
              description: typeof value.description === "string" ? value.description : null,
              type: value.type,
              subtype: typeof value.subtype === "string" ? value.subtype : null,
              status: value.status as TaskStatusValue,
              owners,
              dueDateStart: typeof value.dueDateStart === "string" ? value.dueDateStart : null,
              dueDateEnd: typeof value.dueDateEnd === "string" ? value.dueDateEnd : null,
              completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
              isRecurring: value.isRecurring === true,
              recurrenceCadence,
              recurrenceEndDate:
                typeof value.recurrenceEndDate === "string" ? value.recurrenceEndDate : null,
              recurrenceCount: typeof value.recurrenceCount === "number" ? value.recurrenceCount : null,
              parentTaskId: typeof value.parentTaskId === "string" ? value.parentTaskId : null,
              documentLinks,
              createdAt: value.createdAt,
              updatedAt: value.updatedAt,
              linkedDocumentCount:
                typeof value.linkedDocumentCount === "number"
                  ? value.linkedDocumentCount
                  : documentLinks.length,
              noteCount: typeof value.noteCount === "number" ? value.noteCount : 0,
              workflowSpawnedTaskId:
                typeof value.workflowSpawnedTaskId === "string" ? value.workflowSpawnedTaskId : null,
              workflowTaskTemplateId:
                typeof value.workflowTaskTemplateId === "string" ? value.workflowTaskTemplateId : null,
              workflowTaskTemplateTitle:
                typeof value.workflowTaskTemplateTitle === "string"
                  ? value.workflowTaskTemplateTitle
                  : null,
            }

            return parsedTask
          })
          .filter((item): item is TaskEntry => item !== null)

      setTasks(parsedTasks)
    } catch (error) {
      console.error(error)
      setEmailToast({ kind: "error", message: "Failed to load tasks" })
    } finally {
      setIsLoadingTasks(false)
    }
  }, [clientData.id])

  const loadTaskTypeOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/task-types")
      if (!response.ok) {
        throw new Error("Failed to load task type options")
      }

      const payload = (await response.json()) as unknown
      if (!Array.isArray(payload)) {
        setTaskTypeOptions([])
        return
      }

      setTaskTypeOptions(
        payload
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null
            }

            const value = item as Record<string, unknown>
            if (typeof value.type !== "string" || !Array.isArray(value.subtypes)) {
              return null
            }

            const subtypes = value.subtypes.filter(
              (subtype): subtype is string => typeof subtype === "string" && subtype.trim().length > 0,
            )

            return {
              type: value.type,
              subtypes,
            } satisfies TaskTypeGroup
          })
          .filter((item): item is TaskTypeGroup => Boolean(item)),
      )
    } catch (error) {
      console.error(error)
      setEmailToast({ kind: "error", message: "Failed to load task types" })
    }
  }, [])

  const loadOwnerOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) {
        throw new Error("Failed to load users")
      }

      const payload = (await response.json()) as { users?: unknown[] }
      const rawUsers = Array.isArray(payload.users) ? payload.users : []

      setOwnerOptions(
        rawUsers
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null
            }

            const value = item as Record<string, unknown>
            if (typeof value.id !== "string" || typeof value.fullName !== "string" || typeof value.email !== "string") {
              return null
            }

            return {
              id: value.id,
              fullName: value.fullName,
              email: value.email,
            } satisfies TaskOwnerOption
          })
          .filter((item): item is TaskOwnerOption => Boolean(item)),
      )
    } catch (error) {
      console.error(error)
      setEmailToast({ kind: "error", message: "Failed to load task owners" })
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadWorkflowTemplates() {
      setIsLoadingWorkflowTemplates(true)

      try {
        const response = await fetch("/api/workflow-templates")
        if (!response.ok) {
          throw new Error("Failed to fetch workflow templates")
        }

        const templatesPayload = await response.json()
        if (!Array.isArray(templatesPayload)) {
          return
        }

        if (isMounted) {
          setWorkflowTemplates(
            templatesPayload
              .map((template) => {
                if (!template || typeof template !== "object" || Array.isArray(template)) {
                  return null
                }

                const value = template as Record<string, unknown>
                if (typeof value.id !== "string" || typeof value.name !== "string") {
                  return null
                }

                return {
                  id: value.id,
                  name: value.name,
                }
              })
              .filter((template): template is WorkflowTemplateOption => Boolean(template)),
          )
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsLoadingWorkflowTemplates(false)
        }
      }
    }

    void loadWorkflowTemplates()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    void loadTaskTypeOptions()
    void loadOwnerOptions()
  }, [loadOwnerOptions, loadTaskTypeOptions])

  useEffect(() => {
    if (!emailToast) {
      return
    }

    const timer = window.setTimeout(() => {
      setEmailToast(null)
    }, 3500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [emailToast])

  useEffect(() => {
    if (!isIncomeDrawerOpen) {
      return
    }

    let isMounted = true

    async function loadIncomeItems() {
      setIsLoadingIncome(true)

      try {
        const response = await fetch(`/api/clients/${clientData.id}/income`)
        if (!response.ok) {
          throw new Error("Failed to fetch income items")
        }

        const payload = await response.json()
        if (!Array.isArray(payload) || !isMounted) {
          return
        }

        setIncomeItems(
          payload
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null
              }

              const value = item as Record<string, unknown>
              if (
                typeof value.id !== "string" ||
                typeof value.incomeType !== "string" ||
                typeof value.amount !== "number" ||
                typeof value.frequency !== "string" ||
                typeof value.isGross !== "boolean"
              ) {
                return null
              }

              return {
                id: value.id,
                incomeType: value.incomeType,
                description: typeof value.description === "string" ? value.description : null,
                amount: value.amount,
                frequency: value.frequency,
                isGross: value.isGross,
              }
            })
            .filter((item): item is IncomeItem => Boolean(item)),
        )
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsLoadingIncome(false)
        }
      }
    }

    void loadIncomeItems()

    return () => {
      isMounted = false
    }
  }, [clientData.id, isIncomeDrawerOpen])

  useEffect(() => {
    if (!isAssetsDrawerOpen) {
      return
    }

    let isMounted = true

    async function loadAssets() {
      setIsLoadingAssets(true)

      try {
        const response = await fetch(`/api/clients/${clientData.id}/assets`)
        if (!response.ok) {
          throw new Error("Failed to fetch assets")
        }

        const payload = await response.json()
        if (!payload || typeof payload !== "object" || Array.isArray(payload) || !isMounted) {
          return
        }

        const value = payload as Record<string, unknown>
        const rawPropertyAssets = Array.isArray(value.propertyAssets) ? value.propertyAssets : []
        const rawFinancialAccounts = Array.isArray(value.financialAccounts) ? value.financialAccounts : []

        setPropertyAssets(
          rawPropertyAssets
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null
              }

              const asset = item as Record<string, unknown>
              if (typeof asset.id !== "string" || typeof asset.currentValue !== "number") {
                return null
              }

              const addressValue =
                asset.address && typeof asset.address === "object" && !Array.isArray(asset.address)
                  ? (asset.address as Record<string, unknown>)
                  : null

              return {
                id: asset.id,
                usageType: typeof asset.usageType === "string" ? asset.usageType : null,
                currentValue: asset.currentValue,
                address: {
                  line1: typeof addressValue?.line1 === "string" ? addressValue.line1 : null,
                  suburb: typeof addressValue?.suburb === "string" ? addressValue.suburb : null,
                  state: typeof addressValue?.state === "string" ? addressValue.state : null,
                  postcode: typeof addressValue?.postcode === "string" ? addressValue.postcode : null,
                },
              }
            })
            .filter((item): item is PropertyAssetItem => Boolean(item)),
        )

        setFinancialAccounts(
          rawFinancialAccounts
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null
              }

              const account = item as Record<string, unknown>
              if (
                typeof account.id !== "string" ||
                typeof account.accountType !== "string" ||
                typeof account.currentBalance !== "number"
              ) {
                return null
              }

              return {
                id: account.id,
                accountType: account.accountType,
                currentBalance: account.currentBalance,
                institutionName: typeof account.institutionName === "string" ? account.institutionName : null,
              }
            })
            .filter((item): item is FinancialAccountItem => Boolean(item)),
        )
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsLoadingAssets(false)
        }
      }
    }

    void loadAssets()

    return () => {
      isMounted = false
    }
  }, [clientData.id, isAssetsDrawerOpen])

  useEffect(() => {
    if (!isLiabilitiesDrawerOpen) {
      return
    }

    let isMounted = true

    async function loadLiabilities() {
      setIsLoadingLiabilities(true)

      try {
        const response = await fetch(`/api/clients/${clientData.id}/liabilities`)
        if (!response.ok) {
          throw new Error("Failed to fetch liabilities")
        }

        const payload = await response.json()
        if (!Array.isArray(payload) || !isMounted) {
          return
        }

        setLiabilityItems(
          payload
            .map((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                return null
              }

              const value = item as Record<string, unknown>
              if (
                typeof value.id !== "string" ||
                typeof value.liabilityType !== "string" ||
                typeof value.currentBalance !== "number"
              ) {
                return null
              }

              return {
                id: value.id,
                liabilityType: value.liabilityType,
                description: typeof value.description === "string" ? value.description : null,
                currentBalance: value.currentBalance,
                interestRate: typeof value.interestRate === "number" ? value.interestRate : null,
                repaymentAmount: typeof value.repaymentAmount === "number" ? value.repaymentAmount : null,
                repaymentFrequency:
                  typeof value.repaymentFrequency === "string" ? value.repaymentFrequency : null,
              }
            })
            .filter((item): item is LiabilityItem => Boolean(item)),
        )
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsLoadingLiabilities(false)
        }
      }
    }

    void loadLiabilities()

    return () => {
      isMounted = false
    }
  }, [clientData.id, isLiabilitiesDrawerOpen])

  function updateAddIdField<Key extends keyof AddIdFormState>(key: Key, value: AddIdFormState[Key]) {
    setAddIdForm((current) => ({ ...current, [key]: value }))
  }

  function updateEngagementField<Key extends keyof EngagementFormState>(key: Key, value: EngagementFormState[Key]) {
    setEngagementForm((current) => ({ ...current, [key]: value }))
  }

  function updateIncomeField<Key extends keyof IncomeFormState>(key: Key, value: IncomeFormState[Key]) {
    setIncomeForm((current) => ({ ...current, [key]: value }))
  }

  function updatePropertyField<Key extends keyof PropertyFormState>(key: Key, value: PropertyFormState[Key]) {
    setPropertyForm((current) => ({ ...current, [key]: value }))
  }

  function updateAccountField<Key extends keyof AccountFormState>(key: Key, value: AccountFormState[Key]) {
    setAccountForm((current) => ({ ...current, [key]: value }))
  }

  function updateLiabilityField<Key extends keyof LiabilityFormState>(key: Key, value: LiabilityFormState[Key]) {
    setLiabilityForm((current) => ({ ...current, [key]: value }))
  }

  function updateRiskProfileField<Key extends keyof RiskProfileFormState>(
    key: Key,
    value: RiskProfileFormState[Key],
  ) {
    setRiskProfileForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSaveEngagement() {
    if (!clientData.household || !engagementForm.title.trim()) {
      return
    }

    setIsSavingEngagement(true)

    try {
      const response = await fetch("/api/engagements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          householdId: clientData.household.id,
          engagementType: engagementForm.engagementType,
          title: engagementForm.title,
          description: engagementForm.description,
          templateId: engagementForm.templateId || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save engagement")
      }

      const createdEngagement = await response.json()

      setLocalEngagements((current) => [
        {
          id: typeof createdEngagement.id === "string" ? createdEngagement.id : String(Date.now()),
          engagementType:
            typeof createdEngagement.engagementType === "string"
              ? createdEngagement.engagementType
              : engagementForm.engagementType,
          title:
            typeof createdEngagement.title === "string" && createdEngagement.title.trim()
              ? createdEngagement.title
              : engagementForm.title.trim(),
          status:
            typeof createdEngagement.status === "string" && createdEngagement.status.trim()
              ? createdEngagement.status
              : "active",
          startedAt:
            typeof createdEngagement.startedAt === "string" && createdEngagement.startedAt.trim()
              ? createdEngagement.startedAt
              : "just-now",
          workflowInstance:
            createdEngagement.workflowInstance &&
            typeof createdEngagement.workflowInstance === "object" &&
            !Array.isArray(createdEngagement.workflowInstance) &&
            typeof (createdEngagement.workflowInstance as Record<string, unknown>).id === "string" &&
            typeof (createdEngagement.workflowInstance as Record<string, unknown>).currentStage === "string"
              ? {
                  id: (createdEngagement.workflowInstance as Record<string, string>).id,
                  currentStage: (createdEngagement.workflowInstance as Record<string, string>).currentStage,
                  status:
                    (createdEngagement.workflowInstance as Record<string, string>).status?.trim() ||
                    "active",
                  stages: Array.isArray(
                    (createdEngagement.workflowInstance as Record<string, unknown>).stages,
                  )
                    ? ((createdEngagement.workflowInstance as Record<string, unknown>).stages as unknown[])
                        .map((stage) => {
                          if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
                            return null
                          }

                          const stageValue = stage as Record<string, unknown>
                          if (
                            typeof stageValue.key !== "string" ||
                            typeof stageValue.label !== "string" ||
                            typeof stageValue.order !== "number"
                          ) {
                            return null
                          }

                          return {
                            key: stageValue.key,
                            label: stageValue.label,
                            order: stageValue.order,
                          }
                        })
                        .filter(
                          (stage): stage is { key: string; label: string; order: number } => Boolean(stage),
                        )
                    : [],
                }
              : null,
        },
        ...current,
      ])
      setEngagementForm(buildEngagementForm())
      setIsEngagementPanelOpen(false)
      setActiveFilter("all")
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingEngagement(false)
    }
  }

  async function handleCreateHousehold() {
    if (!householdNameInput.trim()) {
      return
    }

    setIsCreatingHousehold(true)

    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          householdName: householdNameInput,
          memberIds: [clientData.id],
          primaryMemberId: clientData.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create household")
      }

      setHouseholdNameInput("")
      setIsLinkingHousehold(false)
      refreshClientData()
    } catch (error) {
      console.error(error)
    } finally {
      setIsCreatingHousehold(false)
    }
  }

  async function handleLifecycleStageChange(nextStage: LifecycleStage) {
    setIsUpdatingLifecycle(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/classification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lifecycleStage: nextStage }),
      })

      if (!response.ok) {
        throw new Error("Failed to update lifecycle stage")
      }

      const updated = await response.json()

      setClientData((current) => ({
        ...current,
        classification: {
          serviceTier:
            updated.service_segment ?? updated.service_tier ?? current.classification?.serviceTier ?? null,
          lifecycleStage: updated.lifecycle_stage ?? null,
        },
      }))
      setIsLifecycleMenuOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUpdatingLifecycle(false)
    }
  }

  async function handleServiceTierChange(nextTier: ServiceTier | null) {
    setIsUpdatingServiceTier(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/classification`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceTier: nextTier }),
      })

      if (!response.ok) {
        throw new Error("Failed to update service tier")
      }

      const updated = await response.json()

      setClientData((current) => ({
        ...current,
        classification: {
          serviceTier: updated.service_segment ?? updated.service_tier ?? null,
          lifecycleStage: updated.lifecycle_stage ?? current.classification?.lifecycleStage ?? null,
        },
      }))
      setIsServiceTierMenuOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUpdatingServiceTier(false)
    }
  }

  async function handleSaveVerificationCheck() {
    setIsSavingIdVerification(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: addIdForm.documentType,
          documentReference: addIdForm.documentReference,
          expiryDate: addIdForm.expiryDate,
          result: addIdForm.result,
          notes: addIdForm.notes,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create verification check")
      }

      const created = await response.json()
      const createdCheck: VerificationCheck = {
        id: created.id,
        checkType: created.check_type,
        documentType: created.identity_document_type,
        documentReference: created.document_reference,
        result: formatVerificationResult(created.result),
        verifiedAt: created.verified_at,
        expiryDate: created.expiry_date,
        notes: created.notes,
      }

      setVerificationChecks((current) => [createdCheck, ...current])
      setAddIdForm(buildAddIdForm())
      setIsAddIdFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingIdVerification(false)
    }
  }

  function handleOpenIncomeDrawer() {
    setIsAssetsDrawerOpen(false)
    setIsLiabilitiesDrawerOpen(false)
    setIsIncomeDrawerOpen(true)
  }

  function handleCloseIncomeDrawer() {
    setIsIncomeDrawerOpen(false)
    setIsAddIncomeFormOpen(false)
    setIncomeForm(buildIncomeForm())
  }

  function handleOpenAddIncomeForm() {
    setIsAddIncomeFormOpen(true)
  }

  function handleCancelAddIncomeForm() {
    setIsAddIncomeFormOpen(false)
    setIncomeForm(buildIncomeForm())
  }

  async function handleSaveIncome() {
    const amountValue = Number(incomeForm.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return
    }

    setIsSavingIncome(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/income`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          incomeType: incomeForm.incomeType,
          description: incomeForm.description,
          amount: amountValue,
          frequency: incomeForm.frequency,
          isGross: incomeForm.isGross,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create income item")
      }

      const created = await response.json()
      if (!created || typeof created !== "object" || Array.isArray(created)) {
        throw new Error("Invalid income response")
      }

      const value = created as Record<string, unknown>
      if (
        typeof value.id !== "string" ||
        typeof value.incomeType !== "string" ||
        typeof value.amount !== "number" ||
        typeof value.frequency !== "string" ||
        typeof value.isGross !== "boolean"
      ) {
        throw new Error("Invalid income response")
      }

      const createdIncome: IncomeItem = {
        id: value.id,
        incomeType: value.incomeType,
        description: typeof value.description === "string" ? value.description : null,
        amount: value.amount,
        frequency: value.frequency,
        isGross: value.isGross,
      }

      setIncomeItems((current) => [
        createdIncome,
        ...current,
      ])
      setIncomeForm(buildIncomeForm())
      setIsAddIncomeFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingIncome(false)
    }
  }

  function handleOpenAssetsDrawer() {
    setIsIncomeDrawerOpen(false)
    setIsLiabilitiesDrawerOpen(false)
    setIsAssetsDrawerOpen(true)
  }

  function handleCloseAssetsDrawer() {
    setIsAssetsDrawerOpen(false)
    setIsAddPropertyFormOpen(false)
    setIsAddAccountFormOpen(false)
    setPropertyForm(buildPropertyForm())
    setAccountForm(buildAccountForm())
  }

  function handleOpenAddPropertyForm() {
    setIsAddPropertyFormOpen(true)
    setIsAddAccountFormOpen(false)
  }

  function handleCancelAddPropertyForm() {
    setIsAddPropertyFormOpen(false)
    setPropertyForm(buildPropertyForm())
  }

  async function handleSaveProperty() {
    const currentValue = Number(propertyForm.currentValue)
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      return
    }

    if (
      !propertyForm.addressLine1.trim() ||
      !propertyForm.suburb.trim() ||
      !propertyForm.state.trim() ||
      !propertyForm.postcode.trim()
    ) {
      return
    }

    setIsSavingProperty(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "property",
          usageType: propertyForm.usageType,
          currentValue,
          addressLine1: propertyForm.addressLine1,
          suburb: propertyForm.suburb,
          state: propertyForm.state,
          postcode: propertyForm.postcode,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create property asset")
      }

      const created = await response.json()
      if (!created || typeof created !== "object" || Array.isArray(created)) {
        throw new Error("Invalid property response")
      }

      const root = created as Record<string, unknown>
      if (!root.item || typeof root.item !== "object" || Array.isArray(root.item)) {
        throw new Error("Invalid property response")
      }

      const value = root.item as Record<string, unknown>
      if (
        typeof value.id !== "string" ||
        (!value.address || typeof value.address !== "object" || Array.isArray(value.address)) ||
        typeof value.currentValue !== "number"
      ) {
        throw new Error("Invalid property response")
      }

      const address = value.address as Record<string, unknown>
      const createdProperty: PropertyAssetItem = {
        id: value.id,
        address: {
          line1: typeof address.line1 === "string" ? address.line1 : null,
          suburb: typeof address.suburb === "string" ? address.suburb : null,
          state: typeof address.state === "string" ? address.state : null,
          postcode: typeof address.postcode === "string" ? address.postcode : null,
        },
        usageType: typeof value.usageType === "string" ? value.usageType : null,
        currentValue: value.currentValue,
      }

      setPropertyAssets((current) => [createdProperty, ...current])
      setPropertyForm(buildPropertyForm())
      setIsAddPropertyFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingProperty(false)
    }
  }

  function handleOpenAddAccountForm() {
    setIsAddAccountFormOpen(true)
    setIsAddPropertyFormOpen(false)
  }

  function handleCancelAddAccountForm() {
    setIsAddAccountFormOpen(false)
    setAccountForm(buildAccountForm())
  }

  async function handleSaveAccount() {
    const currentBalance = Number(accountForm.currentBalance)
    if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
      return
    }

    setIsSavingAccount(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "account",
          accountType: accountForm.accountType,
          currentBalance,
          institutionName: accountForm.institutionName,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create financial account")
      }

      const created = await response.json()
      if (!created || typeof created !== "object" || Array.isArray(created)) {
        throw new Error("Invalid account response")
      }

      const root = created as Record<string, unknown>
      if (!root.item || typeof root.item !== "object" || Array.isArray(root.item)) {
        throw new Error("Invalid account response")
      }

      const value = root.item as Record<string, unknown>
      if (
        typeof value.id !== "string" ||
        typeof value.accountType !== "string" ||
        typeof value.currentBalance !== "number"
      ) {
        throw new Error("Invalid account response")
      }

      const createdAccount: FinancialAccountItem = {
        id: value.id,
        accountType: value.accountType,
        currentBalance: value.currentBalance,
        institutionName: typeof value.institutionName === "string" ? value.institutionName : null,
      }

      setFinancialAccounts((current) => [createdAccount, ...current])
      setAccountForm(buildAccountForm())
      setIsAddAccountFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingAccount(false)
    }
  }

  function handleOpenLiabilitiesDrawer() {
    setIsIncomeDrawerOpen(false)
    setIsAssetsDrawerOpen(false)
    setIsLiabilitiesDrawerOpen(true)
  }

  function handleCloseLiabilitiesDrawer() {
    setIsLiabilitiesDrawerOpen(false)
    setIsAddLiabilityFormOpen(false)
    setLiabilityForm(buildLiabilityForm())
  }

  function handleOpenAddLiabilityForm() {
    setIsAddLiabilityFormOpen(true)
  }

  function handleCancelAddLiabilityForm() {
    setIsAddLiabilityFormOpen(false)
    setLiabilityForm(buildLiabilityForm())
  }

  async function handleSaveLiability() {
    const currentBalance = Number(liabilityForm.currentBalance)
    if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
      return
    }

    const interestRateValue = liabilityForm.interestRate.trim()
      ? Number(liabilityForm.interestRate)
      : null
    if (interestRateValue !== null && !Number.isFinite(interestRateValue)) {
      return
    }

    const repaymentAmountValue = liabilityForm.repaymentAmount.trim()
      ? Number(liabilityForm.repaymentAmount)
      : null
    if (repaymentAmountValue !== null && !Number.isFinite(repaymentAmountValue)) {
      return
    }

    setIsSavingLiability(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/liabilities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          liabilityType: liabilityForm.liabilityType,
          description: liabilityForm.description,
          currentBalance,
          interestRate: interestRateValue,
          repaymentAmount: repaymentAmountValue,
          repaymentFrequency: liabilityForm.repaymentFrequency,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create liability")
      }

      const created = await response.json()
      if (!created || typeof created !== "object" || Array.isArray(created)) {
        throw new Error("Invalid liability response")
      }

      const value = created as Record<string, unknown>
      if (
        typeof value.id !== "string" ||
        typeof value.liabilityType !== "string" ||
        typeof value.currentBalance !== "number"
      ) {
        throw new Error("Invalid liability response")
      }

      const createdLiability: LiabilityItem = {
        id: value.id,
        liabilityType: value.liabilityType,
        description: typeof value.description === "string" ? value.description : null,
        currentBalance: value.currentBalance,
        interestRate: typeof value.interestRate === "number" ? value.interestRate : null,
        repaymentAmount: typeof value.repaymentAmount === "number" ? value.repaymentAmount : null,
        repaymentFrequency: typeof value.repaymentFrequency === "string" ? value.repaymentFrequency : null,
      }

      setLiabilityItems((current) => [createdLiability, ...current])
      setLiabilityForm(buildLiabilityForm())
      setIsAddLiabilityFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingLiability(false)
    }
  }

  function handleOpenAddRiskProfileForm() {
    setRiskProfileForm(buildRiskProfileForm())
    setIsAddRiskProfileFormOpen(true)
  }

  function handleCancelAddRiskProfileForm() {
    setRiskProfileForm(buildRiskProfileForm())
    setIsAddRiskProfileFormOpen(false)
  }

  function handleRiskProfileOverrideChange(checked: boolean) {
    setRiskProfileForm((current) => {
      const numericScore = Number(current.score)
      const derivedAllocation =
        Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 100
          ? scoreToAllocation(numericScore)
          : current.overrideAllocation

      return {
        ...current,
        overrideFlag: checked,
        overrideAllocation: checked ? derivedAllocation : current.overrideAllocation,
        overrideReason: checked ? current.overrideReason : "",
      }
    })
  }

  async function handleSaveRiskProfile() {
    const numericScore = Number(riskProfileForm.score)
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
      return
    }

    if (riskProfileForm.overrideFlag && !riskProfileForm.overrideReason.trim()) {
      return
    }

    setIsSavingRiskProfile(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}/risk-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: Math.round(numericScore),
          capacityForLoss: riskProfileForm.capacityForLoss,
          validUntil: riskProfileForm.validUntil || null,
          overrideFlag: riskProfileForm.overrideFlag,
          overrideReason: riskProfileForm.overrideFlag ? riskProfileForm.overrideReason : null,
          overrideAllocation: riskProfileForm.overrideFlag ? riskProfileForm.overrideAllocation : null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create risk profile")
      }

      const created = await response.json()
      if (!created || typeof created !== "object" || Array.isArray(created)) {
        throw new Error("Invalid risk profile response")
      }

      const value = created as Record<string, unknown>
      if (typeof value.id !== "string" || typeof value.riskResult !== "string") {
        throw new Error("Invalid risk profile response")
      }

      const createdRiskProfile: ClientDetail["riskProfile"] = {
        id: value.id,
        riskResult: value.riskResult,
        score: typeof value.score === "number" ? value.score : null,
        capacityForLoss: typeof value.capacityForLoss === "string" ? value.capacityForLoss : null,
        overrideFlag: typeof value.overrideFlag === "boolean" ? value.overrideFlag : false,
        overrideReason: typeof value.overrideReason === "string" ? value.overrideReason : null,
        completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
        validUntil: typeof value.validUntil === "string" ? value.validUntil : null,
      }

      setClientData((current) => ({
        ...current,
        riskProfile: createdRiskProfile,
      }))
      setRiskProfileForm(buildRiskProfileForm())
      setIsAddRiskProfileFormOpen(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingRiskProfile(false)
    }
  }

  function openEngagementPanel() {
    setActiveDetailTab("timeline")
    setIsEngagementPanelOpen(true)
    setActiveFilter("all")
  }

  function openTaskModalForCreate() {
    setActiveDetailTab("timeline")
    setIsEngagementPanelOpen(false)
    setTaskModalMode("create")
    setEditingTask(null)
    setIsTaskModalOpen(true)
    setActiveFilter("tasks")
  }

  function openTaskModalForEdit(task: TaskEntry) {
    setTaskModalMode("edit")
    setEditingTask(task)
    setIsTaskModalOpen(true)
  }

  const loadTaskDocuments = useCallback(async (taskId: string) => {
    if (taskDocumentsByTaskId[taskId]) {
      return
    }

    setIsLoadingTaskDocumentsForId(taskId)

    try {
      const response = await fetch(`/api/tasks/${taskId}/documents`)
      if (!response.ok) {
        throw new Error("Failed to load linked task documents")
      }

      const payload = (await response.json()) as { documents?: unknown[] }
      const rawDocuments = Array.isArray(payload.documents) ? payload.documents : []

      const documents = rawDocuments
        .map((item): TaskLinkedDocument | null => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null
          }

          const value = item as Record<string, unknown>
          if (
            typeof value.id !== "string" ||
            typeof value.taskId !== "string" ||
            typeof value.sharepointDriveItemId !== "string" ||
            typeof value.fileName !== "string" ||
            typeof value.folder !== "string" ||
            typeof value.createdAt !== "string"
          ) {
            return null
          }

          return {
            id: value.id,
            taskId: value.taskId,
            sharepointDriveItemId: value.sharepointDriveItemId,
            fileName: value.fileName,
            folder: value.folder,
            createdAt: value.createdAt,
            webUrl: typeof value.webUrl === "string" ? value.webUrl : null,
            downloadUrl: typeof value.downloadUrl === "string" ? value.downloadUrl : null,
            lastModifiedDateTime: typeof value.lastModifiedDateTime === "string" ? value.lastModifiedDateTime : null,
            size: typeof value.size === "number" ? value.size : null,
            existsInSharePoint: value.existsInSharePoint === true,
          }
        })
        .filter((item): item is TaskLinkedDocument => Boolean(item))

      setTaskDocumentsByTaskId((current) => ({
        ...current,
        [taskId]: documents,
      }))
    } catch (error) {
      console.error(error)
      setEmailToast({
        kind: "error",
        message: "Failed to load linked task documents",
      })
    } finally {
      setIsLoadingTaskDocumentsForId((current) => (current === taskId ? null : current))
    }
  }, [taskDocumentsByTaskId])

  const loadTaskNotes = useCallback(async (taskId: string) => {
    if (taskNotesByTaskId[taskId]) {
      return
    }

    setIsLoadingTaskNotesForId(taskId)

    try {
      const response = await fetch(`/api/tasks/${taskId}/notes`)
      if (!response.ok) {
        throw new Error("Failed to load task notes")
      }

      const payload = (await response.json()) as { notes?: unknown[] }
      const rawNotes = Array.isArray(payload.notes) ? payload.notes : []

      const notes = rawNotes
        .map((item): TaskNoteEntry | null => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null
          }

          const value = item as Record<string, unknown>
          if (
            typeof value.id !== "string" ||
            typeof value.body !== "string" ||
            typeof value.createdAt !== "string" ||
            typeof value.source !== "string" ||
            !["CONCILIO", "MONDAY", "SYSTEM"].includes(value.source)
          ) {
            return null
          }

          const author =
            value.author && typeof value.author === "object" && !Array.isArray(value.author)
              ? (value.author as Record<string, unknown>)
              : null

          return {
            id: value.id,
            body: value.body,
            source: value.source as TaskNoteEntry["source"],
            createdAt: value.createdAt,
            author:
              author &&
              typeof author.id === "string" &&
              typeof author.fullName === "string" &&
              typeof author.email === "string"
                ? {
                    id: author.id,
                    fullName: author.fullName,
                    email: author.email,
                  }
                : null,
          }
        })
        .filter((item): item is TaskNoteEntry => Boolean(item))

      setTaskNotesByTaskId((current) => ({
        ...current,
        [taskId]: notes,
      }))
    } catch (error) {
      console.error(error)
      setEmailToast({
        kind: "error",
        message: "Failed to load task notes",
      })
    } finally {
      setIsLoadingTaskNotesForId((current) => (current === taskId ? null : current))
    }
  }, [taskNotesByTaskId])

  function toggleTaskExpand(taskId: string) {
    setExpandedTaskId((current) => {
      const next = current === taskId ? null : taskId
      if (next) {
        void loadTaskDocuments(next)
        void loadTaskNotes(next)
      }
      return next
    })
  }

  async function handleQuickTaskStatusChange(taskId: string, status: TaskStatusValue) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update task status")
      }

      await loadTasks()
    } catch (error) {
      console.error(error)
      setEmailToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to update task status",
      })
    }
  }

  async function handleDeleteTask(taskId: string) {
    const isConfirmed = window.confirm("Delete this task?")
    if (!isConfirmed) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete task")
      }

      setExpandedTaskId((current) => (current === taskId ? null : current))
      await loadTasks()
    } catch (error) {
      console.error(error)
      setEmailToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to delete task",
      })
    }
  }

  function openDocumentsTab() {
    setActiveDetailTab("documents")
    setIsEngagementPanelOpen(false)
  }

  function openTimelineTab() {
    setActiveDetailTab("timeline")
  }

  function openQuickAdd(kind: QuickAddKind) {
    setActiveDetailTab("timeline")
    setQuickAddOpen(kind)
  }

  function handleQuickAddSuccess() {
    setTimelineRefreshKey((current) => current + 1)
    setActiveDetailTab("timeline")
  }

  function refreshClientData() {
    router.refresh()
  }

  function renderSectionEditButton(kind: Exclude<SectionModalKind, null>) {
    return (
      <button
        type="button"
        onClick={() => setOpenSectionModal(kind)}
        className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
      >
        Edit
      </button>
    )
  }

  function openCreateDependantModal() {
    setDependantModalState({ mode: "create", member: null })
  }

  function openEditDependantModal(member: ClientHouseholdMember) {
    setDependantModalState({ mode: "edit", member })
  }

  function handleDependantSaved() {
    refreshClientData()
  }

  function handleCancelEngagement() {
    setEngagementForm(buildEngagementForm())
    setIsEngagementPanelOpen(false)
  }

  function handleOpenAddIdForm() {
    setIsAddIdFormOpen(true)
  }

  function handleCancelAddIdForm() {
    setAddIdForm(buildAddIdForm())
    setIsAddIdFormOpen(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[12px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Link href="/clients" className="inline-flex text-[12px] text-[#9ca3af]">
              {"\u2190"} Clients
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-semibold leading-tight text-[#113238]">{clientData.displayName}</h1>
              <span
                className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(clientData.status)}`}
              >
                {clientData.status}
              </span>
              {serviceTier ? (
                <span
                  className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getClassificationClasses(serviceTier)}`}
                >
                  {formatClassificationValue(serviceTier)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6b7280]">
              <span>{clientData.household?.name ?? "No household"}</span>
              <span>Lifecycle: {lifecycleStage ? formatClassificationValue(lifecycleStage) : "Not set"}</span>
              <span>{clientData.resolvedEmail ?? "No email"}</span>
              <span>{clientData.resolvedMobile ?? "No mobile"}</span>
              <span>Adviser: Andrew Rowan</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {headerIndicators.map((indicator) => (
                <HeaderStatusPill key={`${indicator.label}-${indicator.value}`} indicator={indicator} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openQuickAdd("phone_call")}
                className="inline-flex items-center gap-[6px] rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[5px] text-[12px] text-white"
              >
                <PhoneIcon />
                + Phone Call
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd("meeting")}
                className="inline-flex items-center gap-[6px] rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[5px] text-[12px] text-white"
              >
                <MeetingIcon />
                + Meeting
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd("file_note")}
                className="inline-flex items-center gap-[6px] rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[5px] text-[12px] text-white"
              >
                <NoteHeaderIcon />
                + Note
              </button>
            </div>
            <DeleteClientButton clientId={clientData.id} clientName={clientData.displayName} />
            <button
              type="button"
              onClick={() => setIsEmailTemplateModalOpen(true)}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
            >
              Email
            </button>
            <button
              type="button"
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
            >
              SMS
            </button>
            <button
              type="button"
              onClick={handleOpenIncomeDrawer}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
            >
              Income
            </button>
            <button
              type="button"
              onClick={handleOpenAssetsDrawer}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
            >
              Assets
            </button>
            <button
              type="button"
              onClick={handleOpenLiabilitiesDrawer}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
            >
              Liabilities
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#F7F9FB]">
        <div className="space-y-4 px-[18px] py-[14px]">
          <div className="flex flex-col rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-4">
          <ExpandableSection title="Contact" action={renderSectionEditButton("contact")} className="order-2">
            <div className="space-y-[10px]">
              <DetailField label="Email" value={clientData.resolvedEmail ?? null} />
              <DetailField label="Alternate email" value={clientData.person?.emailAlternate ?? null} />
              <DetailField label="Mobile" value={clientData.resolvedMobile ?? null} />
              <DetailField
                label="Preferred contact method"
                value={clientData.resolvedPreferredContactMethod ?? null}
              />
            </div>
          </ExpandableSection>

          <ExpandableSection title="Address" action={renderSectionEditButton("address")} className="order-3">
            {residentialAddressLines.length > 0 ? (
              <div className="space-y-[10px]">
                <div className="space-y-1">
                  {residentialAddressLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-[13px] leading-[1.6] text-[#113238]">
                      {line}
                    </p>
                  ))}
                </div>

                {showPostalAddress ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#9ca3af]">Postal</p>
                    {postalAddressLines.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-[13px] leading-[1.6] text-[#113238]">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-[#9ca3af]">No address on file</p>
            )}
          </ExpandableSection>

          <ExpandableSection
            title="Household"
            action={clientData.household ? renderSectionEditButton("household") : undefined}
            className="order-4"
          >
            {clientData.household ? (
              <div className="space-y-4">
                <p className="text-[12px] font-medium text-[#113238]">{clientData.household.name}</p>
                <p className="text-[11px] text-[#9ca3af]">{formatHouseholdRole(clientData.household.role)}</p>

                <div className="grid gap-3 md:grid-cols-3">
                  <DetailField label="Salutation (informal)" value={clientData.household.salutationInformal ?? "—"} />
                  <DetailField label="Address title (formal)" value={clientData.household.addressTitleFormal ?? "—"} />
                  <DetailField label="Notes" value={clientData.household.householdNotes ?? "—"} />
                </div>

                <div className="space-y-2 border-t-[0.5px] border-[#f0f0f0] pt-3">
                  <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Adults</h3>
                  {adultHouseholdMembers.length > 0 ? (
                    <div className="space-y-1">
                      {adultHouseholdMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#FAFBFC] px-3 py-2">
                          <div>
                            {member.partyId === clientData.id ? (
                              <p className="text-[12px] font-medium text-[#113238]">{member.displayName}</p>
                            ) : (
                              <Link
                                href={`/clients/${member.partyId}`}
                                className="text-[12px] font-medium text-[#113238] underline-offset-2 hover:underline"
                              >
                                {member.displayName}
                              </Link>
                            )}
                            <p className="text-[11px] text-[#9ca3af]">{formatHouseholdRole(member.role)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#9ca3af]">No adult members recorded</p>
                  )}
                </div>

                <div className="space-y-2 border-t-[0.5px] border-[#f0f0f0] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Dependants</h3>
                    <button
                      type="button"
                      onClick={openCreateDependantModal}
                      className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
                    >
                      + Add dependant
                    </button>
                  </div>

                  {dependantHouseholdMembers.length > 0 ? (
                    <div className="space-y-2">
                      {dependantHouseholdMembers.map((member) => {
                        const age = calculateAge(member.dateOfBirth)
                        const notes = truncateText(member.dependantNotes)

                        return (
                          <div key={member.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-[13px] font-medium text-[#113238]">{member.displayName}</p>
                                <p className="text-[11px] text-[#6b7280]">
                                  {formatHouseholdRelation(member.relation)}
                                  {age !== null ? ` - Age ${age}` : " - Age not recorded"}
                                </p>
                                <p className="text-[11px] text-[#6b7280]">
                                  {member.isFinancialDependant
                                    ? `Financial dependant${member.dependantUntilAge !== null ? ` until ${member.dependantUntilAge}` : ""}`
                                    : "Not marked financially dependant"}
                                </p>
                                {notes ? <p className="text-[11px] text-[#6b7280]">{notes}</p> : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDependantModal(member)}
                                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDependantDeleteTarget(member)}
                                  className="rounded-[6px] border-[0.5px] border-[#FCA5A5] bg-white px-[8px] py-[4px] text-[10px] text-[#B42318]"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#9ca3af]">No dependants recorded</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-[10px]">
                <p className="text-[11px] text-[#9ca3af]">No household</p>
                <button
                  type="button"
                  onClick={() => setIsLinkingHousehold((current) => !current)}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
                >
                  Link to household
                </button>
                {isLinkingHousehold ? (
                  <div className="space-y-2">
                    <input
                      value={householdNameInput}
                      onChange={(event) => setHouseholdNameInput(event.target.value)}
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      onClick={handleCreateHousehold}
                      disabled={isCreatingHousehold}
                      className="w-full rounded-[6px] bg-[#FF8C42] px-[8px] py-[6px] text-[10px] text-white disabled:opacity-60"
                    >
                      Create & link
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </ExpandableSection>

          <ExpandableSection title="Personal details" action={renderSectionEditButton("personal")} className="order-1">
            <div className="space-y-[10px]">
              <DetailField label="Full legal name" value={fullLegalName} />
              <DetailField label="Title" value={clientData.person?.title ?? null} />
              <DetailField label="Middle names" value={clientData.person?.legalMiddleNames ?? null} />
              <DetailField label="Preferred name" value={clientData.person?.preferredName ?? null} />
              <DetailField label="Maiden name" value={clientData.person?.maidenName ?? null} />
              <DetailField label="Mother's maiden name" value={clientData.person?.mothersMaidenName ?? null} />
              <DetailField label="Date of birth" value={formatDate(clientData.person?.dateOfBirth ?? null)} />
              <DetailField label="Gender" value={clientData.person?.gender ?? null} />
              <DetailField label="Gender pronouns" value={clientData.person?.genderPronouns ?? null} />
              <DetailField label="Relationship status" value={clientData.person?.relationshipStatus ?? null} />
              <DetailField label="Place of birth" value={clientData.person?.placeOfBirth ?? null} />
              <DetailField label="Country of birth" value={clientData.person?.countryOfBirth ?? null} />
              <DetailField label="Country of residence" value={clientData.person?.countryOfResidence ?? null} />
              <DetailField label="Resident status" value={clientData.person?.residentStatus ?? null} />
              <DetailField label="Country of tax residency" value={clientData.person?.countryOfTaxResidency ?? null} />
              <DetailField label="Tax resident status" value={clientData.person?.taxResidentStatus ?? null} />
            </div>
            <div className="mt-4 border-t-[0.5px] border-[#f0f0f0] pt-4">
              <div className="mb-[10px] flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Identity</h3>
                <button
                  type="button"
                  onClick={handleOpenAddIdForm}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[4px] text-[10px] text-[#113238]"
                >
                  + Add ID
                </button>
              </div>

              {isAddIdFormOpen ? (
                <div className="mb-3 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                  <EditField label="Document type">
                    <select
                      value={addIdForm.documentType}
                      onChange={(event) => updateAddIdField("documentType", event.target.value as VerificationDocumentType)}
                      className={inputClassName}
                    >
                      {verificationDocumentTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </EditField>

                  <EditField label="Document reference">
                    <input
                      value={addIdForm.documentReference}
                      onChange={(event) => updateAddIdField("documentReference", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <EditField label="Expiry date">
                    <input
                      type="date"
                      value={addIdForm.expiryDate}
                      onChange={(event) => updateAddIdField("expiryDate", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <EditField label="Result">
                    <select
                      value={addIdForm.result}
                      onChange={(event) => updateAddIdField("result", event.target.value as VerificationResult)}
                      className={inputClassName}
                    >
                      {verificationResultOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </EditField>

                  <EditField label="Notes (optional)">
                    <textarea
                      value={addIdForm.notes}
                      onChange={(event) => updateAddIdField("notes", event.target.value)}
                      className={`${inputClassName} min-h-[70px] resize-y`}
                    />
                  </EditField>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveVerificationCheck}
                      disabled={isSavingIdVerification}
                      className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                    >
                      {isSavingIdVerification ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddIdForm}
                      className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {verificationChecks.length === 0 ? (
                <p className="text-[12px] text-[#9ca3af]">No ID documents on file</p>
              ) : (
                <div className="space-y-2">
                  {verificationChecks.map((check) => {
                    const result = formatVerificationResult(check.result)
                    const expiryState = getExpiryState(check.expiryDate)

                    return (
                      <div key={check.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-[10px]">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-medium text-[#113238]">{formatDocumentType(check.documentType)}</p>
                          <span
                            className={`inline-flex rounded-[999px] px-[8px] py-[2px] text-[10px] uppercase ${getVerificationResultBadgeClasses(result)}`}
                          >
                            {result}
                          </span>
                        </div>

                        <p className="mt-1 text-[12px] text-[#6b7280]">
                          {check.documentReference?.trim()
                            ? `Reference: ${check.documentReference}`
                            : "Reference not provided"}
                        </p>

                        {check.expiryDate ? (
                          <p className={`mt-1 text-[12px] ${getExpiryTextClass(expiryState)}`}>
                            Expires {formatDate(check.expiryDate)}
                          </p>
                        ) : null}

                        <p className="mt-1 text-[11px] text-[#9ca3af]">verified {formatDate(check.verifiedAt)}</p>

                        {check.notes ? <p className="mt-1 text-[11px] text-[#6b7280]">{check.notes}</p> : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 border-t-[0.5px] border-[#f0f0f0] pt-4">
              <h3 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Identity & risk</h3>
              <div className="space-y-[10px]">
                <DetailField label="PEP risk" value={clientData.person?.isPepRisk ? "Yes" : "No"} />
                {clientData.person?.pepNotes ? (
                  <DetailField label="PEP notes" value={clientData.person.pepNotes} />
                ) : null}
              </div>
            </div>
            <div className="mt-4 border-t-[0.5px] border-[#f0f0f0] pt-4">
              <h3 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Emergency Contact</h3>
              {hasEmergencyContact ? (
                <div className="space-y-[10px]">
                  <DetailField label="Name" value={clientData.person?.emergencyContactName ?? null} />
                  <DetailField label="Relationship" value={clientData.person?.emergencyContactRelationship ?? null} />
                  <DetailField label="Phone" value={clientData.person?.emergencyContactPhone ?? null} />
                  <DetailField label="Email" value={clientData.person?.emergencyContactEmail ?? null} />
                  <DetailField label="Notes" value={clientData.person?.emergencyContactNotes ?? null} />
                </div>
              ) : (
                <p className="text-[12px] text-[#9ca3af]">No emergency contact recorded.</p>
              )}
            </div>
          </ExpandableSection>

          <ExpandableSection title="Employment" action={renderSectionEditButton("employment")} className="order-5">
            {clientData.employment ? (
              <div className="space-y-[10px]">
                <DetailField
                  label="Employment status"
                  value={
                    clientData.employment.employmentStatus
                      ? formatCategory(clientData.employment.employmentStatus)
                      : null
                  }
                />
                <DetailField label="Employer name" value={clientData.employment.employerName} />
                <DetailField label="Occupation" value={clientData.employment.occupation} />
                <DetailField label="Industry" value={clientData.employment.industry} />
                <DetailField
                  label="Employment type"
                  value={
                    clientData.employment.employmentType
                      ? formatCategory(clientData.employment.employmentType)
                      : null
                  }
                />
              </div>
            ) : (
              <p className="text-[12px] text-[#9ca3af]">No employment on file</p>
            )}
          </ExpandableSection>

          <ExpandableSection title="Risk Profile" className="order-6">

            {clientData.riskProfile ? (
              <div className="space-y-2">
                <p className="text-[20px] font-semibold text-[#113238]">{clientData.riskProfile.riskResult}</p>
                <p className="text-[11px] text-[#9ca3af]">Risk / Defensive</p>
                <p className="text-[12px] text-[#6b7280]">
                  Finametrica score:{" "}
                  {clientData.riskProfile.score !== null ? clientData.riskProfile.score : "Not provided"}
                </p>
                <p className="text-[11px] text-[#9ca3af]">
                  Valid until: {formatDate(clientData.riskProfile.validUntil)}
                </p>

                {clientData.riskProfile.overrideFlag ? (
                  <div className="rounded-[8px] border-[0.5px] border-[#FCD34D] bg-[#FFFBEB] p-2">
                    <p className="text-[11px] text-[#92400E]">
                      {clientData.riskProfile.overrideReason && clientData.riskProfile.overrideReason.trim()
                        ? clientData.riskProfile.overrideReason
                        : "Allocation overridden"}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!clientData.riskProfile && !isAddRiskProfileFormOpen ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[#9ca3af]">No risk profile on file</p>
                <button
                  type="button"
                  onClick={handleOpenAddRiskProfileForm}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                >
                  + Add
                </button>
              </div>
            ) : null}

            {isAddRiskProfileFormOpen ? (
              <div className="space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                <EditField label="Finametrica Score">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={riskProfileForm.score}
                    onChange={(event) => updateRiskProfileField("score", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <p className="text-[12px] text-[#FF8C42]">
                  Recommended allocation: {recommendedAllocation ?? "Enter a score"}
                </p>

                <EditField label="Capacity for loss">
                  <select
                    value={riskProfileForm.capacityForLoss}
                    onChange={(event) => updateRiskProfileField("capacityForLoss", event.target.value as CapacityForLoss)}
                    className={inputClassName}
                  >
                    {capacityForLossOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Valid until (optional)">
                  <input
                    type="date"
                    value={riskProfileForm.validUntil}
                    onChange={(event) => updateRiskProfileField("validUntil", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <label className="flex items-center gap-2 text-[12px] text-[#113238]">
                  <input
                    type="checkbox"
                    checked={riskProfileForm.overrideFlag}
                    onChange={(event) => handleRiskProfileOverrideChange(event.target.checked)}
                  />
                  Override recommended allocation
                </label>

                {riskProfileForm.overrideFlag ? (
                  <div className="space-y-[10px]">
                    <div className="rounded-[8px] border-[0.5px] border-[#FCD34D] bg-[#FFFBEB] p-2">
                      <p className="text-[11px] text-[#92400E]">Override requires a documented reason</p>
                    </div>

                    <EditField label="Allocation">
                      <select
                        value={riskProfileForm.overrideAllocation}
                        onChange={(event) =>
                          updateRiskProfileField("overrideAllocation", event.target.value as RiskAllocation)
                        }
                        className={inputClassName}
                      >
                        {riskAllocationOptions.map((allocation) => (
                          <option key={allocation} value={allocation}>
                            {allocation}
                          </option>
                        ))}
                      </select>
                    </EditField>

                    <EditField label="Override reason">
                      <textarea
                        value={riskProfileForm.overrideReason}
                        onChange={(event) => updateRiskProfileField("overrideReason", event.target.value)}
                        className={`${inputClassName} min-h-[70px] resize-y`}
                      />
                    </EditField>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveRiskProfile}
                    disabled={
                      isSavingRiskProfile ||
                      !riskProfileForm.score.trim() ||
                      (riskProfileForm.overrideFlag && !riskProfileForm.overrideReason.trim())
                    }
                    className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                  >
                    {isSavingRiskProfile ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddRiskProfileForm}
                    className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </ExpandableSection>

          <ExpandableSection title="Service" className="order-7">
            <div className="space-y-[10px]">
              <div className="relative space-y-[6px]">
              <p className="text-[11px] text-[#9ca3af]">Lifecycle stage</p>
              <button
                type="button"
                onClick={() => {
                  setIsLifecycleMenuOpen((current) => !current)
                  setIsServiceTierMenuOpen(false)
                }}
                className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[6px] text-[12px] text-[#113238]"
              >
                {lifecycleStage ? formatClassificationValue(lifecycleStage) : "Not set"}
              </button>

              {isLifecycleMenuOpen ? (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                  {lifecycleStageOptions.map((option) => {
                    const isSelected = option.value === lifecycleStage

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleLifecycleStageChange(option.value)}
                        disabled={isUpdatingLifecycle}
                        className={`block w-full cursor-pointer px-3 py-2 text-left text-[12px] ${
                          isSelected
                            ? "bg-[#113238] text-white"
                            : "text-[#113238] hover:bg-[#F5F7FA]"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              </div>
              <div className="relative space-y-[6px]">
                <p className="text-[11px] text-[#9ca3af]">Service tier</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsServiceTierMenuOpen((current) => !current)
                    setIsLifecycleMenuOpen(false)
                  }}
                  className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[8px] py-[6px] text-left"
                >
                  {serviceTier ? (
                    <span
                      className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getClassificationClasses(serviceTier)}`}
                    >
                      {formatClassificationValue(serviceTier)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#9ca3af]">Not set</span>
                  )}
                </button>

                {isServiceTierMenuOpen ? (
                  <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                    {serviceTierOptions.map((option) => {
                      const isSelected = option.value === serviceTier

                      return (
                        <button
                          key={option.value ?? "none"}
                          type="button"
                          onClick={() => void handleServiceTierChange(option.value)}
                          disabled={isUpdatingServiceTier}
                          className={`block w-full cursor-pointer px-3 py-2 text-left text-[12px] ${
                            isSelected
                              ? "bg-[#113238] text-white"
                              : "text-[#113238] hover:bg-[#F5F7FA]"
                          }`}
                        >
                          {option.value ? (
                            <span
                              className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${
                                isSelected ? "bg-[#113238] text-white" : getClassificationClasses(option.value)
                              }`}
                            >
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection title="Important information" className="order-8">
            <p className="text-[12px] text-[#6b7280]">
              Sensitive credentials reveal coming in a future round
            </p>
          </ExpandableSection>

        </div>

        <section className="flex min-h-[560px] flex-col">
          <ClientJourney
            clientId={journeyClientId}
            clientScope={journeyClientScope}
            clientDisplayName={clientData.displayName}
            onMutation={() => {
              window.location.reload()
            }}
          />

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={openTimelineTab}
              className={`rounded-[7px] border-[0.5px] px-[10px] py-[5px] text-[12px] ${
                activeDetailTab === "timeline"
                  ? "border-[#113238] bg-[#113238] text-white"
                  : "border-[#e5e7eb] bg-white text-[#113238]"
              }`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={openDocumentsTab}
              className={`rounded-[7px] border-[0.5px] px-[10px] py-[5px] text-[12px] ${
                activeDetailTab === "documents"
                  ? "border-[#113238] bg-[#113238] text-white"
                  : "border-[#e5e7eb] bg-white text-[#113238]"
              }`}
            >
              Documents
            </button>
          </div>

          {activeDetailTab === "timeline" && (
            <ClientTimeline party_id={clientData.id} refreshKey={timelineRefreshKey} />
          )}

          {activeDetailTab === "documents" && (
            <DocumentsTab clientId={clientData.id} />
          )}
        </section>
      </div>
      </div>

      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
          isIncomeDrawerOpen ? "pointer-events-auto bg-[rgba(17,50,56,0.18)] opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleCloseIncomeDrawer}
      >
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`flex h-full w-full max-w-[400px] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
            isIncomeDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-4 py-3">
            <h2 className="text-[16px] font-semibold text-[#113238]">Income</h2>
            <button
              type="button"
              onClick={handleCloseIncomeDrawer}
              className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[9px] py-[4px] text-[14px] leading-none text-[#113238]"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingIncome ? (
              <p className="text-[12px] text-[#9ca3af]">Loading income...</p>
            ) : incomeItems.length > 0 ? (
              <div className="space-y-2">
                {incomeItems.map((item) => (
                  <div key={item.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium text-[#113238]">{formatCategory(item.incomeType)}</p>
                      <span className="inline-flex rounded-[999px] bg-[#F3F4F6] px-[8px] py-[2px] text-[10px] text-[#6B7280]">
                        {item.isGross ? "Gross" : "Net"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[#6b7280]">
                      {item.description && item.description.trim() ? item.description : "No description"}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[13px] font-medium text-[#113238]">{formatCurrency(item.amount)}</p>
                      <p className="text-[11px] text-[#9ca3af]">{formatIncomeFrequency(item.frequency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#9ca3af]">No income items on file</p>
            )}

            {isAddIncomeFormOpen ? (
              <div className="mt-4 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                <EditField label="Income type">
                  <select
                    value={incomeForm.incomeType}
                    onChange={(event) => updateIncomeField("incomeType", event.target.value)}
                    className={inputClassName}
                  >
                    {incomeTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatCategory(option)}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Description">
                  <input
                    value={incomeForm.description}
                    onChange={(event) => updateIncomeField("description", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Amount">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={incomeForm.amount}
                    onChange={(event) => updateIncomeField("amount", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Frequency">
                  <select
                    value={incomeForm.frequency}
                    onChange={(event) => updateIncomeField("frequency", event.target.value as IncomeFrequency)}
                    className={inputClassName}
                  >
                    {incomeFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </EditField>

                <label className="flex items-center gap-2 text-[12px] text-[#113238]">
                  <input
                    type="checkbox"
                    checked={incomeForm.isGross}
                    onChange={(event) => updateIncomeField("isGross", event.target.checked)}
                  />
                  Is gross
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveIncome}
                    disabled={isSavingIncome}
                    className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                  >
                    {isSavingIncome ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddIncomeForm}
                    className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddIncomeForm}
                className="mt-4 w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[7px] text-[12px] text-[#113238]"
              >
                + Add income
              </button>
            )}
          </div>
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
          isAssetsDrawerOpen ? "pointer-events-auto bg-[rgba(17,50,56,0.18)] opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={handleCloseAssetsDrawer}
      >
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`flex h-full w-full max-w-[400px] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
            isAssetsDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-4 py-3">
            <h2 className="text-[16px] font-semibold text-[#113238]">Assets</h2>
            <button
              type="button"
              onClick={handleCloseAssetsDrawer}
              className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[9px] py-[4px] text-[14px] leading-none text-[#113238]"
            >
              x
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <section>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[#9ca3af]">Property assets</h3>
              {isLoadingAssets ? (
                <p className="mt-2 text-[12px] text-[#9ca3af]">Loading assets...</p>
              ) : propertyAssets.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {propertyAssets.map((item) => (
                    <div key={item.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
                      <p className="text-[12px] font-medium text-[#113238]">{formatAddressSummary(item.address)}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-[#6b7280]">
                          {item.usageType ? formatCategory(item.usageType) : "Usage not provided"}
                        </p>
                        <p className="text-[13px] font-medium text-[#113238]">{formatCurrency(item.currentValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-[#9ca3af]">No property assets on file</p>
              )}

              {isAddPropertyFormOpen ? (
                <div className="mt-3 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                  <EditField label="Usage type">
                    <select
                      value={propertyForm.usageType}
                      onChange={(event) => updatePropertyField("usageType", event.target.value)}
                      className={inputClassName}
                    >
                      {propertyUsageOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatCategory(option)}
                        </option>
                      ))}
                    </select>
                  </EditField>

                  <EditField label="Current value">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={propertyForm.currentValue}
                      onChange={(event) => updatePropertyField("currentValue", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <EditField label="Address line 1">
                    <input
                      value={propertyForm.addressLine1}
                      onChange={(event) => updatePropertyField("addressLine1", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <div className="grid grid-cols-2 gap-2">
                    <EditField label="Suburb">
                      <input
                        value={propertyForm.suburb}
                        onChange={(event) => updatePropertyField("suburb", event.target.value)}
                        className={inputClassName}
                      />
                    </EditField>
                    <EditField label="State">
                      <input
                        value={propertyForm.state}
                        onChange={(event) => updatePropertyField("state", event.target.value)}
                        className={inputClassName}
                      />
                    </EditField>
                  </div>

                  <EditField label="Postcode">
                    <input
                      value={propertyForm.postcode}
                      onChange={(event) => updatePropertyField("postcode", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveProperty}
                      disabled={isSavingProperty}
                      className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                    >
                      {isSavingProperty ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddPropertyForm}
                      className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAddPropertyForm}
                  className="mt-3 w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[7px] text-[12px] text-[#113238]"
                >
                  + Add property
                </button>
              )}
            </section>

            <section>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[#9ca3af]">Financial accounts</h3>
              {isLoadingAssets ? (
                <p className="mt-2 text-[12px] text-[#9ca3af]">Loading accounts...</p>
              ) : financialAccounts.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {financialAccounts.map((item) => (
                    <div key={item.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-[#113238]">{formatCategory(item.accountType)}</p>
                        <p className="text-[13px] font-medium text-[#113238]">{formatCurrency(item.currentBalance)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-[#6b7280]">
                        {item.institutionName && item.institutionName.trim()
                          ? item.institutionName
                          : "Institution not provided"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-[#9ca3af]">No financial accounts on file</p>
              )}

              {isAddAccountFormOpen ? (
                <div className="mt-3 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                  <EditField label="Account type">
                    <select
                      value={accountForm.accountType}
                      onChange={(event) => updateAccountField("accountType", event.target.value)}
                      className={inputClassName}
                    >
                      {accountTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatCategory(option)}
                        </option>
                      ))}
                    </select>
                  </EditField>

                  <EditField label="Current balance">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={accountForm.currentBalance}
                      onChange={(event) => updateAccountField("currentBalance", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <EditField label="Institution name">
                    <input
                      value={accountForm.institutionName}
                      onChange={(event) => updateAccountField("institutionName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAccount}
                      disabled={isSavingAccount}
                      className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                    >
                      {isSavingAccount ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddAccountForm}
                      className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAddAccountForm}
                  className="mt-3 w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[7px] text-[12px] text-[#113238]"
                >
                  + Add account
                </button>
              )}
            </section>
          </div>
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
          isLiabilitiesDrawerOpen
            ? "pointer-events-auto bg-[rgba(17,50,56,0.18)] opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={handleCloseLiabilitiesDrawer}
      >
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`flex h-full w-full max-w-[400px] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
            isLiabilitiesDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-4 py-3">
            <h2 className="text-[16px] font-semibold text-[#113238]">Liabilities</h2>
            <button
              type="button"
              onClick={handleCloseLiabilitiesDrawer}
              className="rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-white px-[9px] py-[4px] text-[14px] leading-none text-[#113238]"
            >
              x
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingLiabilities ? (
              <p className="text-[12px] text-[#9ca3af]">Loading liabilities...</p>
            ) : liabilityItems.length > 0 ? (
              <div className="space-y-2">
                {liabilityItems.map((item) => (
                  <div key={item.id} className="rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium text-[#113238]">{formatCategory(item.liabilityType)}</p>
                      <p className="text-[13px] font-medium text-[#113238]">{formatCurrency(item.currentBalance)}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-[#6b7280]">
                      {item.description && item.description.trim() ? item.description : "No description"}
                    </p>
                    <div className="mt-1 space-y-1 text-[11px] text-[#6b7280]">
                      {item.interestRate !== null ? <p>Interest rate: {item.interestRate}%</p> : null}
                      {item.repaymentAmount !== null ? (
                        <p>
                          Repayment: {formatCurrency(item.repaymentAmount)}
                          {item.repaymentFrequency ? ` / ${formatCategory(item.repaymentFrequency)}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#9ca3af]">No liabilities on file</p>
            )}

            {isAddLiabilityFormOpen ? (
              <div className="mt-4 space-y-[10px] rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-[10px]">
                <EditField label="Liability type">
                  <select
                    value={liabilityForm.liabilityType}
                    onChange={(event) => updateLiabilityField("liabilityType", event.target.value)}
                    className={inputClassName}
                  >
                    {liabilityTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatCategory(option)}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Description">
                  <input
                    value={liabilityForm.description}
                    onChange={(event) => updateLiabilityField("description", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Current balance">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={liabilityForm.currentBalance}
                    onChange={(event) => updateLiabilityField("currentBalance", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Interest rate">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={liabilityForm.interestRate}
                    onChange={(event) => updateLiabilityField("interestRate", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Repayment amount">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={liabilityForm.repaymentAmount}
                    onChange={(event) => updateLiabilityField("repaymentAmount", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Repayment frequency">
                  <select
                    value={liabilityForm.repaymentFrequency}
                    onChange={(event) =>
                      updateLiabilityField("repaymentFrequency", event.target.value as LiabilityRepaymentFrequency)
                    }
                    className={inputClassName}
                  >
                    {liabilityRepaymentFrequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </EditField>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveLiability}
                    disabled={isSavingLiability}
                    className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                  >
                    {isSavingLiability ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddLiabilityForm}
                    className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddLiabilityForm}
                className="mt-4 w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[7px] text-[12px] text-[#113238]"
              >
                + Add liability
              </button>
            )}
          </div>
        </aside>
      </div>

      <PersonalSectionModal
        clientId={clientData.id}
        clientDetail={clientData}
        isOpen={openSectionModal === "personal"}
        onClose={() => setOpenSectionModal(null)}
        onSaved={refreshClientData}
      />
      <AddressSectionModal
        clientId={clientData.id}
        clientDetail={clientData}
        isOpen={openSectionModal === "address"}
        onClose={() => setOpenSectionModal(null)}
        onSaved={refreshClientData}
      />
      <EmploymentSectionModal
        clientId={clientData.id}
        clientDetail={clientData}
        isOpen={openSectionModal === "employment"}
        onClose={() => setOpenSectionModal(null)}
        onSaved={refreshClientData}
      />
      <ContactSectionModal
        clientId={clientData.id}
        clientDetail={clientData}
        isOpen={openSectionModal === "contact"}
        onClose={() => setOpenSectionModal(null)}
        onSaved={refreshClientData}
      />
      <HouseholdSectionModal
        householdId={clientData.household?.id ?? ""}
        clientDetail={clientData}
        isOpen={openSectionModal === "household" && Boolean(clientData.household)}
        onClose={() => setOpenSectionModal(null)}
        onSaved={refreshClientData}
      />
      <DependantModal
        householdId={clientData.household?.id ?? ""}
        clientId={clientData.id}
        mode={dependantModalState?.mode ?? "create"}
        member={dependantModalState?.member ?? null}
        householdAdultMembers={householdAdultMembers}
        isOpen={Boolean(dependantModalState) && Boolean(clientData.household)}
        onClose={() => setDependantModalState(null)}
        onSaved={handleDependantSaved}
      />
      <DependantDeleteConfirm
        householdId={clientData.household?.id ?? ""}
        member={dependantDeleteTarget}
        isOpen={Boolean(dependantDeleteTarget) && Boolean(clientData.household)}
        onClose={() => setDependantDeleteTarget(null)}
        onDeleted={handleDependantSaved}
      />

      <ClientEmailTemplateModal
        isOpen={isEmailTemplateModalOpen}
        onClose={() => setIsEmailTemplateModalOpen(false)}
        clientId={clientData.id}
        clientName={clientData.displayName}
        onToast={setEmailToast}
        onSent={() => undefined}
      />

      <QuickAddPhoneCallModal
        partyId={clientData.id}
        clientDisplayName={clientData.displayName}
        isOpen={quickAddOpen === "phone_call"}
        onClose={() => setQuickAddOpen(null)}
        onSuccess={handleQuickAddSuccess}
      />
      <QuickAddMeetingModal
        partyId={clientData.id}
        clientDisplayName={clientData.displayName}
        isOpen={quickAddOpen === "meeting"}
        onClose={() => setQuickAddOpen(null)}
        onSuccess={handleQuickAddSuccess}
      />
      <QuickAddNoteModal
        partyId={clientData.id}
        clientDisplayName={clientData.displayName}
        isOpen={quickAddOpen === "file_note"}
        onClose={() => setQuickAddOpen(null)}
        onSuccess={handleQuickAddSuccess}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        mode={taskModalMode}
        clientId={clientData.id}
        task={editingTask}
        taskTypeOptions={taskTypeOptions}
        ownerOptions={ownerOptions}
        onClose={() => setIsTaskModalOpen(false)}
        onSaved={() => void loadTasks()}
        onError={(message) => setEmailToast({ kind: "error", message })}
        onWarning={(message) => setEmailToast({ kind: "warning", message })}
      />

      {emailToast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-[8px] px-3 py-2 text-[12px] shadow ${
            emailToast.kind === "success"
              ? "bg-[#113238] text-white"
              : emailToast.kind === "warning"
                ? "bg-[#B45309] text-white"
                : "bg-[#E24B4A] text-white"
          }`}
        >
          {emailToast.message}
        </div>
      ) : null}
    </div>
  )
}
