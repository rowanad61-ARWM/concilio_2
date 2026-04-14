"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import DocumentsTab from "@/components/clients/DocumentsTab"
import { ENGAGEMENT_TYPE_VALUES } from "@/lib/engagement"
import { scoreToAllocation, type RiskAllocation } from "@/lib/risk"
import type { ClientAddress, ClientDetail, TimelineEngagement, TimelineNote } from "@/types/client-record"

type ClientRecordProps = {
  client: ClientDetail
  notes: TimelineNote[]
}

type TimelineFilter = "all" | "emails" | "notes" | "docs"
type ClientDetailTab = "timeline" | "documents"
type NoteCategory = "general" | "meeting" | "phone_call" | "email" | "compliance" | "other"
type EngagementType = (typeof ENGAGEMENT_TYPE_VALUES)[number]
type LifecycleStage = "prospect" | "engagement" | "advising" | "implementation" | "lapsed"
type ServiceTier = "transaction" | "cashflow_manager" | "wealth_manager" | "wealth_manager_plus"
type VerificationResult = "pass" | "pending" | "fail"
type VerificationDocumentType = "passport" | "drivers_licence" | "medicare_card" | "birth_certificate" | "other"
type VerificationCheck = ClientDetail["verificationChecks"][number]
type IncomeFrequency = "weekly" | "fortnightly" | "monthly" | "annual"
type LiabilityRepaymentFrequency = "weekly" | "fortnightly" | "monthly"
type CapacityForLoss = "low" | "medium" | "high"

type EditFormState = {
  firstName: string
  lastName: string
  preferredName: string
  dateOfBirth: string
  email: string
  mobile: string
  relationshipStatus: string
  countryOfResidence: string
  addressLine1: string
  addressLine2: string
  addressSuburb: string
  addressState: string
  addressPostcode: string
  addressCountry: string
  employmentStatus: string
  employerName: string
  occupation: string
  industry: string
  employmentType: string
}

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
  { label: "Notes", value: "notes" },
  { label: "Docs", value: "docs" },
]

const noteCategories: { label: string; value: NoteCategory }[] = [
  { label: "General", value: "general" },
  { label: "Meeting", value: "meeting" },
  { label: "Phone Call", value: "phone_call" },
  { label: "Email", value: "email" },
  { label: "Compliance", value: "compliance" },
  { label: "Other", value: "other" },
]

const relationshipOptions = ["single", "married", "de_facto", "separated", "divorced", "widowed"]
const employmentStatusOptions = [
  "employed_full_time",
  "employed_part_time",
  "self_employed",
  "unemployed",
  "retired",
  "home_duties",
  "student",
  "other",
]
const employmentTypeOptions = [
  "employed_full_time",
  "employed_part_time",
  "self_employed",
  "other",
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
  { label: "Advising", value: "advising" },
  { label: "Implementation", value: "implementation" },
  { label: "Lapsed", value: "lapsed" },
]
const serviceTierOptions: { label: string; value: ServiceTier | null }[] = [
  { label: "None", value: null },
  { label: "Transaction", value: "transaction" },
  { label: "Cashflow Manager", value: "cashflow_manager" },
  { label: "Wealth Manager", value: "wealth_manager" },
  { label: "Wealth Manager+", value: "wealth_manager_plus" },
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

function buildEditForm(client: ClientDetail): EditFormState {
  const residentialAddress = client.person?.addressResidential

  return {
    firstName: client.person?.legalGivenName ?? "",
    lastName: client.person?.legalFamilyName ?? "",
    preferredName: client.person?.preferredName ?? "",
    dateOfBirth: client.person?.dateOfBirth ? client.person.dateOfBirth.slice(0, 10) : "",
    email: client.person?.emailPrimary ?? "",
    mobile: client.person?.mobilePhone ?? "",
    relationshipStatus: client.person?.relationshipStatus ?? "",
    countryOfResidence: client.person?.countryOfResidence ?? "",
    addressLine1: residentialAddress?.line1 ?? "",
    addressLine2: residentialAddress?.line2 ?? "",
    addressSuburb: residentialAddress?.suburb ?? "",
    addressState: residentialAddress?.state ?? "",
    addressPostcode: residentialAddress?.postcode ?? "",
    addressCountry: residentialAddress?.country ?? "AU",
    employmentStatus: client.employment?.employmentStatus ?? "",
    employerName: client.employment?.employerName ?? "",
    occupation: client.employment?.occupation ?? "",
    industry: client.employment?.industry ?? "",
    employmentType: client.employment?.employmentType ?? "",
  }
}

function mapAddress(value: unknown): ClientAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const address = value as Record<string, unknown>
  return {
    line1: typeof address.line1 === "string" ? address.line1 : null,
    line2: typeof address.line2 === "string" ? address.line2 : null,
    suburb: typeof address.suburb === "string" ? address.suburb : null,
    state: typeof address.state === "string" ? address.state : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
    country: typeof address.country === "string" ? address.country : null,
  }
}

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
  if (value === "wealth_manager_plus") {
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

function getClassificationClasses(value: string) {
  switch (value) {
    case "wealth_manager_plus":
      return "bg-[#FEF0E7] text-[#C45F1A]"
    case "wealth_manager":
      return "bg-[#EAF0F1] text-[#113238]"
    case "cashflow_manager":
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

export default function ClientRecord({ client, notes }: ClientRecordProps) {
  const [clientData, setClientData] = useState(client)
  const [activeDetailTab, setActiveDetailTab] = useState<ClientDetailTab>("timeline")
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>(client.verificationChecks)
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all")
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false)
  const [isEngagementPanelOpen, setIsEngagementPanelOpen] = useState(false)
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("general")
  const [noteBody, setNoteBody] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingEngagement, setIsSavingEngagement] = useState(false)
  const [isSavingIncome, setIsSavingIncome] = useState(false)
  const [isSavingProperty, setIsSavingProperty] = useState(false)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isSavingLiability, setIsSavingLiability] = useState(false)
  const [isSavingRiskProfile, setIsSavingRiskProfile] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes)
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
  const [isLoadingLiabilities, setIsLoadingLiabilities] = useState(false)
  const [liabilityItems, setLiabilityItems] = useState<LiabilityItem[]>([])
  const [isAddLiabilityFormOpen, setIsAddLiabilityFormOpen] = useState(false)
  const [liabilityForm, setLiabilityForm] = useState<LiabilityFormState>(() => buildLiabilityForm())
  const [isAddRiskProfileFormOpen, setIsAddRiskProfileFormOpen] = useState(false)
  const [riskProfileForm, setRiskProfileForm] = useState<RiskProfileFormState>(() => buildRiskProfileForm())
  const [engagementForm, setEngagementForm] = useState<EngagementFormState>(() => buildEngagementForm())
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateOption[]>([])
  const [isLoadingWorkflowTemplates, setIsLoadingWorkflowTemplates] = useState(false)
  const [advancingWorkflowId, setAdvancingWorkflowId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingChanges, setIsSavingChanges] = useState(false)
  const [editForm, setEditForm] = useState<EditFormState>(() => buildEditForm(client))
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

  const fullLegalName = clientData.person
    ? `${clientData.person.legalGivenName} ${clientData.person.legalFamilyName}`.trim()
    : null

  const visibleNotes = activeFilter === "all" || activeFilter === "notes" ? localNotes : []
  const visibleEngagements = activeFilter === "all" ? localEngagements : []
  const timelineItems = [
    ...visibleEngagements.map((engagement) => ({
      kind: "engagement" as const,
      id: `engagement-${engagement.id}`,
      timestamp: engagement.startedAt,
      engagement,
    })),
    ...visibleNotes.map((note) => ({
      kind: "note" as const,
      id: `note-${note.id}`,
      timestamp: note.createdAt,
      note,
    })),
  ].sort((left, right) => getTimelineSortValue(right.timestamp) - getTimelineSortValue(left.timestamp))
  const otherHouseholdMembers = clientData.household?.members.filter((member) => member.id !== clientData.id) ?? []
  const lifecycleStage = clientData.classification?.lifecycleStage ?? null
  const serviceTier = clientData.classification?.serviceTier ?? null
  const residentialAddress = clientData.person?.addressResidential ?? null
  const postalAddress = clientData.person?.addressPostal ?? null
  const residentialAddressLines = formatAddressLines(residentialAddress)
  const postalAddressLines = formatAddressLines(postalAddress)
  const showPostalAddress = postalAddressLines.length > 0 && !addressesEqual(residentialAddress, postalAddress)
  const riskScoreValue = Number(riskProfileForm.score)
  const recommendedAllocation =
    Number.isFinite(riskScoreValue) && riskScoreValue >= 0 && riskScoreValue <= 100
      ? scoreToAllocation(riskScoreValue)
      : null

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

  function updateEditField<Key extends keyof EditFormState>(key: Key, value: EditFormState[Key]) {
    setEditForm((current) => ({ ...current, [key]: value }))
  }

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

  async function handleSaveNote() {
    if (!noteBody.trim()) {
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partyId: clientData.id,
          body: noteBody,
          category: noteCategory,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save note")
      }

      const createdNote = await response.json()

      setLocalNotes((currentNotes) => [
        {
          id: createdNote.id,
          noteType: createdNote.note_type,
          text: createdNote.text,
          createdAt: "just-now",
        },
        ...currentNotes,
      ])
      setNoteBody("")
      setNoteCategory("general")
      setIsNotePanelOpen(false)
      setActiveFilter("notes")
    } catch (error) {
      console.error(error)
    } finally {
      setIsSaving(false)
    }
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

  async function handleAdvanceWorkflowStage(workflowInstanceId: string) {
    setAdvancingWorkflowId(workflowInstanceId)

    try {
      const response = await fetch(`/api/workflow-instances/${workflowInstanceId}`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to advance workflow stage")
      }

      const updatedWorkflow = await response.json()
      if (!updatedWorkflow || typeof updatedWorkflow !== "object" || Array.isArray(updatedWorkflow)) {
        return
      }

      const workflowValue = updatedWorkflow as Record<string, unknown>
      const nextCurrentStage =
        typeof workflowValue.currentStage === "string" ? workflowValue.currentStage : null
      const nextStatus = typeof workflowValue.status === "string" ? workflowValue.status : null

      if (!nextCurrentStage || !nextStatus) {
        return
      }

      setLocalEngagements((current) =>
        current.map((engagement) => {
          if (engagement.workflowInstance?.id !== workflowInstanceId) {
            return engagement
          }

          return {
            ...engagement,
            workflowInstance: {
              ...engagement.workflowInstance,
              currentStage: nextCurrentStage,
              status: nextStatus,
            },
          }
        }),
      )
    } catch (error) {
      console.error(error)
    } finally {
      setAdvancingWorkflowId(null)
    }
  }

  async function handleSaveChanges() {
    setIsSavingChanges(true)

    try {
      const response = await fetch(`/api/clients/${clientData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          preferredName: editForm.preferredName,
          dateOfBirth: editForm.dateOfBirth,
          email: editForm.email,
          mobile: editForm.mobile,
          relationshipStatus: editForm.relationshipStatus,
          countryOfResidence: editForm.countryOfResidence,
          employmentStatus: editForm.employmentStatus || null,
          employerName: editForm.employerName || null,
          occupation: editForm.occupation || null,
          industry: editForm.industry || null,
          employmentType: editForm.employmentType || null,
          addressResidential: {
            line1: editForm.addressLine1 || null,
            line2: editForm.addressLine2 || null,
            suburb: editForm.addressSuburb || null,
            state: editForm.addressState || null,
            postcode: editForm.addressPostcode || null,
            country: editForm.addressCountry || null,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update client")
      }

      const updated = await response.json()

      const nextClientData: ClientDetail = {
        ...clientData,
        displayName: updated.displayName,
        person: clientData.person
          ? {
              ...clientData.person,
              legalGivenName: updated.person.legal_given_name,
              legalFamilyName: updated.person.legal_family_name,
              preferredName: updated.person.preferred_name,
              dateOfBirth: updated.person.date_of_birth,
              emailPrimary: updated.person.email_primary,
              mobilePhone: updated.person.mobile_phone,
              relationshipStatus: updated.person.relationship_status,
              countryOfResidence: updated.person.country_of_residence,
              addressResidential: mapAddress(updated.person.address_residential),
              addressPostal: mapAddress(updated.person.address_postal),
            }
          : {
              legalGivenName: updated.person.legal_given_name,
              legalFamilyName: updated.person.legal_family_name,
              preferredName: updated.person.preferred_name,
              dateOfBirth: updated.person.date_of_birth,
              mobilePhone: updated.person.mobile_phone,
              emailPrimary: updated.person.email_primary,
              relationshipStatus: updated.person.relationship_status,
              countryOfResidence: updated.person.country_of_residence,
              preferredContactMethod: null,
              addressResidential: mapAddress(updated.person.address_residential),
              addressPostal: mapAddress(updated.person.address_postal),
            },
        employment:
          updated.employment && typeof updated.employment === "object" && !Array.isArray(updated.employment)
            ? {
                employmentStatus:
                  typeof updated.employment.employmentStatus === "string"
                    ? updated.employment.employmentStatus
                    : null,
                employerName:
                  typeof updated.employment.employerName === "string"
                    ? updated.employment.employerName
                    : null,
                occupation:
                  typeof updated.employment.occupation === "string"
                    ? updated.employment.occupation
                    : null,
                industry:
                  typeof updated.employment.industry === "string" ? updated.employment.industry : null,
                employmentType:
                  typeof updated.employment.employmentType === "string"
                    ? updated.employment.employmentType
                    : null,
              }
            : clientData.employment,
      }

      setClientData(nextClientData)
      setEditForm(buildEditForm(nextClientData))
      setIsEditing(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSavingChanges(false)
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

      const result = await response.json()

      setClientData((current) => ({
        ...current,
        household: {
          id: result.id,
          name: householdNameInput,
          role: "primary",
          members: [
            {
              id: current.id,
              displayName: current.displayName,
              role: "primary",
            },
          ],
        },
      }))
      setHouseholdNameInput("")
      setIsLinkingHousehold(false)
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
          serviceTier: updated.service_tier ?? current.classification?.serviceTier ?? null,
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
          serviceTier: updated.service_tier ?? null,
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

  async function handleCopyAddressFromMember(memberId: string) {
    try {
      const response = await fetch(`/api/clients/${memberId}/address`)

      if (!response.ok) {
        throw new Error("Failed to fetch household member address")
      }

      const result = await response.json()
      const copiedAddress = mapAddress(result.addressResidential)

      setEditForm((current) => ({
        ...current,
        addressLine1: copiedAddress?.line1 ?? "",
        addressLine2: copiedAddress?.line2 ?? "",
        addressSuburb: copiedAddress?.suburb ?? "",
        addressState: copiedAddress?.state ?? "",
        addressPostcode: copiedAddress?.postcode ?? "",
        addressCountry: copiedAddress?.country ?? "",
      }))
    } catch (error) {
      console.error(error)
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

  function openNotePanel() {
    setActiveDetailTab("timeline")
    setIsNotePanelOpen(true)
    setIsEngagementPanelOpen(false)
    setActiveFilter("notes")
  }

  function handleCancelNote() {
    setNoteBody("")
    setNoteCategory("general")
    setIsNotePanelOpen(false)
  }

  function openEngagementPanel() {
    setActiveDetailTab("timeline")
    setIsEngagementPanelOpen(true)
    setIsNotePanelOpen(false)
    setActiveFilter("all")
  }

  function handleCancelEngagement() {
    setEngagementForm(buildEngagementForm())
    setIsEngagementPanelOpen(false)
  }

  function handleStartEditing() {
    setEditForm(buildEditForm(clientData))
    setIsEditing(true)
  }

  function handleCancelEditing() {
    setEditForm(buildEditForm(clientData))
    setIsEditing(false)
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
      <header className="flex items-start justify-between border-b-[0.5px] border-[#e5e7eb] bg-white px-5 py-[14px]">
        <div className="space-y-2">
          <Link href="/clients" className="inline-flex text-[12px] text-[#9ca3af]">
            {"\u2190"} Clients
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold text-[#113238]">{clientData.displayName}</h1>
            <span
              className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(clientData.status)}`}
            >
              {clientData.status}
            </span>
          </div>
          <p className="text-[12px] text-[#6b7280]">Adviser: Andrew Rowan</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartEditing}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
          >
            Edit
          </button>
          <button
            type="button"
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
          <button
            type="button"
            onClick={openNotePanel}
            className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white"
          >
            + Note
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="min-h-full w-[250px] overflow-y-auto border-r-[0.5px] border-[#e5e7eb] bg-white p-4">
          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Contact</h2>
            <div className="space-y-[10px]">
              {isEditing ? (
                <>
                  <EditField label="Email">
                    <input
                      value={editForm.email}
                      onChange={(event) => updateEditField("email", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Mobile">
                    <input
                      value={editForm.mobile}
                      onChange={(event) => updateEditField("mobile", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Date of birth">
                    <input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(event) => updateEditField("dateOfBirth", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <DetailField label="Email" value={clientData.person?.emailPrimary ?? null} />
                  <DetailField label="Mobile" value={clientData.person?.mobilePhone ?? null} />
                  <DetailField label="Date of birth" value={formatDate(clientData.person?.dateOfBirth ?? null)} />
                </>
              )}
              <DetailField
                label="Preferred contact method"
                value={clientData.person?.preferredContactMethod ?? null}
              />
            </div>
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Address</h2>
            {isEditing && otherHouseholdMembers.length > 0 ? (
              <div className="mb-[10px] space-y-1">
                {otherHouseholdMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => void handleCopyAddressFromMember(member.id)}
                    className="block cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] text-[#FF8C42] hover:underline"
                  >
                    Same address as {member.displayName}
                  </button>
                ))}
              </div>
            ) : null}
            {isEditing ? (
              <div className="space-y-[10px]">
                <EditField label="Line 1">
                  <input
                    value={editForm.addressLine1}
                    onChange={(event) => updateEditField("addressLine1", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <EditField label="Line 2 (optional)">
                  <input
                    value={editForm.addressLine2}
                    onChange={(event) => updateEditField("addressLine2", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Suburb">
                    <input
                      value={editForm.addressSuburb}
                      onChange={(event) => updateEditField("addressSuburb", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="State">
                    <input
                      value={editForm.addressState}
                      onChange={(event) => updateEditField("addressState", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </div>
                <EditField label="Postcode">
                  <input
                    value={editForm.addressPostcode}
                    onChange={(event) => updateEditField("addressPostcode", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
                <EditField label="Country">
                  <input
                    value={editForm.addressCountry}
                    onChange={(event) => updateEditField("addressCountry", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>
              </div>
            ) : residentialAddressLines.length > 0 ? (
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
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Household</h2>
            {clientData.household ? (
              <div className="space-y-[10px]">
                <p className="text-[12px] font-medium text-[#113238]">{clientData.household.name}</p>
                <p className="text-[11px] text-[#9ca3af]">{formatHouseholdRole(clientData.household.role)}</p>
                {otherHouseholdMembers.length > 0 ? (
                  <div className="space-y-1">
                    {otherHouseholdMembers.map((member) => (
                      <Link
                        key={member.id}
                        href={`/clients/${member.id}`}
                        className="block text-[11px] text-[#113238] underline-offset-2 hover:underline"
                      >
                        {member.displayName}
                      </Link>
                    ))}
                  </div>
                ) : null}
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
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Personal</h2>
            <div className="space-y-[10px]">
              {isEditing ? (
                <>
                  <EditField label="First name">
                    <input
                      value={editForm.firstName}
                      onChange={(event) => updateEditField("firstName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Last name">
                    <input
                      value={editForm.lastName}
                      onChange={(event) => updateEditField("lastName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Preferred name">
                    <input
                      value={editForm.preferredName}
                      onChange={(event) => updateEditField("preferredName", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                  <EditField label="Relationship status">
                    <select
                      value={editForm.relationshipStatus}
                      onChange={(event) => updateEditField("relationshipStatus", event.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Select</option>
                      {relationshipOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatCategory(option)}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Country of residence">
                    <input
                      value={editForm.countryOfResidence}
                      onChange={(event) => updateEditField("countryOfResidence", event.target.value)}
                      className={inputClassName}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <DetailField label="Full legal name" value={fullLegalName} />
                  <DetailField label="Relationship status" value={clientData.person?.relationshipStatus ?? null} />
                  <DetailField label="Country of residence" value={clientData.person?.countryOfResidence ?? null} />
                </>
              )}
            </div>
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Employment</h2>
            {isEditing ? (
              <div className="space-y-[10px]">
                <EditField label="Employment status">
                  <select
                    value={editForm.employmentStatus}
                    onChange={(event) => updateEditField("employmentStatus", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select</option>
                    {employmentStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatCategory(option)}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Employer name">
                  <input
                    value={editForm.employerName}
                    onChange={(event) => updateEditField("employerName", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Occupation">
                  <input
                    value={editForm.occupation}
                    onChange={(event) => updateEditField("occupation", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Industry">
                  <input
                    value={editForm.industry}
                    onChange={(event) => updateEditField("industry", event.target.value)}
                    className={inputClassName}
                  />
                </EditField>

                <EditField label="Employment type">
                  <select
                    value={editForm.employmentType}
                    onChange={(event) => updateEditField("employmentType", event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select</option>
                    {employmentTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatCategory(option)}
                      </option>
                    ))}
                  </select>
                </EditField>
              </div>
            ) : clientData.employment ? (
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
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Risk Profile</h2>

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
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <div className="mb-[10px] flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Identity</h2>
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
          </section>

          <section className="mb-6 border-b-[0.5px] border-[#f0f0f0] pb-6">
            <h2 className="mb-[10px] text-[11px] uppercase tracking-[0.6px] text-[#9ca3af]">Service</h2>
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
          </section>

          {isEditing ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSavingChanges}
                className="w-full rounded-[7px] bg-[#FF8C42] px-4 py-[10px] text-[12px] text-white disabled:opacity-60"
              >
                {isSavingChanges ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="mt-[6px] w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-[10px] text-[12px] text-[#113238]"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </aside>

        <section className="flex flex-1 flex-col overflow-y-auto bg-[#F7F9FB] px-[18px] py-[14px]">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveDetailTab("timeline")}
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
              onClick={() => {
                setActiveDetailTab("documents")
                setIsEngagementPanelOpen(false)
                setIsNotePanelOpen(false)
              }}
              className={`rounded-[7px] border-[0.5px] px-[10px] py-[5px] text-[12px] ${
                activeDetailTab === "documents"
                  ? "border-[#113238] bg-[#113238] text-white"
                  : "border-[#e5e7eb] bg-white text-[#113238]"
              }`}
            >
              Documents
            </button>
          </div>

          {activeDetailTab === "timeline" ? (
            <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {timelineFilters.map((filter) => {
                const isActive = filter.value === activeFilter

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={`rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[9px] py-1 text-[12px] ${
                      isActive ? "bg-[#113238] text-white" : "bg-white text-[#113238]"
                    }`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
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
                onClick={openNotePanel}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white"
              >
                + Note
              </button>
              <button
                type="button"
                onClick={openEngagementPanel}
                className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
              >
                + Engagement
              </button>
            </div>
          </div>

          {isEngagementPanelOpen ? (
            <div className="mt-[14px] rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
              {!clientData.household ? (
                <p className="text-[12px] text-[#9ca3af]">
                  Link this client to a household before creating an engagement.
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <EditField label="Title">
                  <input
                    value={engagementForm.title}
                    onChange={(event) => updateEngagementField("title", event.target.value)}
                    className={inputClassName}
                    required
                  />
                </EditField>

                <EditField label="Type">
                  <select
                    value={engagementForm.engagementType}
                    onChange={(event) => updateEngagementField("engagementType", event.target.value as EngagementType)}
                    className={inputClassName}
                  >
                    {ENGAGEMENT_TYPE_VALUES.map((type) => (
                      <option key={type} value={type}>
                        {formatCategory(type)}
                      </option>
                    ))}
                  </select>
                </EditField>
              </div>

              <div className="mt-3 md:max-w-[50%]">
                <EditField label="Workflow template">
                  <select
                    value={engagementForm.templateId}
                    onChange={(event) => updateEngagementField("templateId", event.target.value)}
                    className={inputClassName}
                    disabled={isLoadingWorkflowTemplates}
                  >
                    <option value="">None</option>
                    {workflowTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </EditField>
              </div>

              <div className="mt-3">
                <EditField label="Description (optional)">
                  <textarea
                    value={engagementForm.description}
                    onChange={(event) => updateEngagementField("description", event.target.value)}
                    className={`${inputClassName} min-h-[80px] resize-y`}
                  />
                </EditField>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveEngagement}
                  disabled={isSavingEngagement || !clientData.household || !engagementForm.title.trim()}
                  className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                >
                  {isSavingEngagement ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEngagement}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {isNotePanelOpen ? (
            <div className="mt-[14px] rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white p-3">
              <div className="flex flex-wrap gap-2">
                {noteCategories.map((category) => {
                  const isActive = category.value === noteCategory

                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setNoteCategory(category.value)}
                      className={`rounded-[999px] border-[0.5px] px-[10px] py-[4px] text-[12px] ${
                        isActive
                          ? "border-[#113238] bg-[#113238] text-white"
                          : "border-[#e5e7eb] bg-white text-[#113238]"
                      }`}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                className="mt-3 min-h-[80px] w-full resize-y rounded-[7px] border-[0.5px] border-[#e5e7eb] p-2 text-[13px] text-[#113238] outline-none"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  className="rounded-[7px] border-[0.5px] border-[#FF8C42] bg-[#FF8C42] px-[10px] py-[5px] text-[12px] text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelNote}
                  className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[5px] text-[12px] text-[#113238]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {timelineItems.length > 0 ? (
            <div className="mt-[14px]">
              {timelineItems.map((item) => (
                <div key={item.id} className="mb-2 rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-[10px]">
                  {item.kind === "engagement" ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <EngagementIcon />
                          <p className="text-[13px] font-medium text-[#113238]">{item.engagement.title}</p>
                          <p className="text-[11px] text-[#9ca3af]">{formatCategory(item.engagement.engagementType)}</p>
                        </div>
                        <p className="shrink-0 text-right text-[12px] text-[#9ca3af]">
                          {formatTimelineTimestamp(item.timestamp)}
                        </p>
                      </div>
                      <div className="mt-[6px] flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-[999px] px-[8px] py-[2px] text-[10px] uppercase ${getStatusClasses(item.engagement.status)}`}
                        >
                          {formatCategory(item.engagement.status)}
                        </span>
                      </div>
                      {item.engagement.workflowInstance ? (
                        <div className="mt-2 rounded-[10px] border-[0.5px] border-[#e5e7eb] bg-[#FAFBFC] p-2">
                          <div className="flex items-center gap-2">
                            {item.engagement.workflowInstance.stages.map((stage, index) => {
                              const currentIndex = item.engagement.workflowInstance
                                ? item.engagement.workflowInstance.stages.findIndex(
                                    (stageItem) => stageItem.key === item.engagement.workflowInstance?.currentStage,
                                  )
                                : -1
                              const stageState = getWorkflowStageState(
                                index,
                                currentIndex < 0 ? 0 : currentIndex,
                                item.engagement.workflowInstance?.status ?? "active",
                              )

                              return (
                                <span
                                  key={stage.key}
                                  className={`h-[8px] w-[8px] rounded-full border ${getWorkflowStageClasses(stageState)}`}
                                  title={stage.label}
                                />
                              )
                            })}
                          </div>
                          <p className="mt-2 text-[11px] text-[#6b7280]">
                            {item.engagement.workflowInstance.stages.find(
                              (stage) => stage.key === item.engagement.workflowInstance?.currentStage,
                            )?.label ?? formatCategory(item.engagement.workflowInstance.currentStage)}
                          </p>
                          {item.engagement.workflowInstance.status !== "completed" ? (
                            <button
                              type="button"
                              onClick={() => void handleAdvanceWorkflowStage(item.engagement.workflowInstance!.id)}
                              disabled={advancingWorkflowId === item.engagement.workflowInstance.id}
                              className="mt-2 rounded-[6px] border-[0.5px] border-[#e5e7eb] bg-transparent px-[8px] py-[4px] text-[11px] text-[#113238] disabled:opacity-60"
                            >
                              {advancingWorkflowId === item.engagement.workflowInstance.id
                                ? "Advancing..."
                                : "Advance stage"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <NoteIcon />
                          <p className="text-[13px] font-medium text-[#113238]">
                            {formatCategory(item.note.noteType)}
                          </p>
                          <p className="text-[11px] text-[#9ca3af]">Andrew Rowan</p>
                        </div>
                        <p className="shrink-0 text-right text-[12px] text-[#9ca3af]">
                          {formatTimelineTimestamp(item.timestamp)}
                        </p>
                      </div>
                      <p className="mt-[6px] text-[13px] leading-[1.6] text-[#374151]">{item.note.text}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-[14px] text-[#9ca3af]">No activity yet</p>
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Notes, engagements, emails and documents will appear here
                </p>
              </div>
            </div>
          )}
            </>
          ) : (
            <DocumentsTab clientId={clientData.id} />
          )}
        </section>
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
    </div>
  )
}
