# Concilio — Master Build List

**ARWM Practice Operating System — Full xplan replacement**
**Owner:** Andrew Rowan
**Status:** Living document — update as items ship or new items emerge.

---

## Today's line

> *"Round 4 shipped end-to-end on Australia East. Adviser doesn't fill forms; conversations become structured data."*
>
> Round 4 closed in two sessions. Eight prompts in the second alone. Recording → AI draft → adviser review → publish, with extracted tasks (us/client tickbox) and three-state fact extraction (Update / Park / Drop on schema-aware targets) and notifications when ready. All running on AU East AI infrastructure. Cut-over target Wednesday morning.

*(Regenerated each session by Claude or an agent. Tone: brief, contextual, earned. No corporate slogans.)*

---

## Document version

- **Version:** 9
- **Last updated:** 3 May 2026 (addendum 16 — Round 4 COMPLETE; cut-over readiness workstream defined)
- **Created:** April 28, 2026 (addendum 9 morning planning)
- See [Changelog](#changelog) at the bottom of this document.

---

## How to use this document

This is the master index of everything that needs to be built for Concilio to replace xplan as ARWM's complete practice operating system. It's a living document — entries get added as needs emerge, ticked off as work ships, with date annotations for traceability.

**Status markers:**
- ✅ **Shipped** — live in production. Commit reference and ship date inline.
- 🟡 **Partial** — some sub-items shipped, others still outstanding. Annotated with what's done.
- ⚪ **Not started** — design/scoping done or pending.
- 🔵 **In progress** — currently being worked on (contributor + date in annotation).
- ❌ **Out of scope** — explicitly deferred or excluded.

**Cut-over priority markers:**
- 🔴 **MVP** — required to begin reducing xplan dependency.
- 🟠 **Cut-over** — required to fully replace xplan.
- 🟢 **Post-cut-over** — enhances Concilio after xplan is gone.

**Date annotations:** items carry inline italic annotations for date added and date completed.

**Loading:** loaded into Claude's context at session start alongside `concilio_state_snapshot.md` and `concilio_handover_framework.md`.

**Updating:** at session end, alongside writing the addendum and updating the snapshot, this document gets updated for any items that shipped, were re-scoped, or newly emerged.

---

## Section index

1. [Foundation & Infrastructure](#1-foundation--infrastructure)
2. [Client Records](#2-client-records)
3. [Households & Relationships](#3-households--relationships)
4. [Lifecycle & Service Tiers](#4-lifecycle--service-tiers)
5. [Engagements & Workflow Engine](#5-engagements--workflow-engine)
6. [Communications](#6-communications)
7. [Unified Timeline](#7-unified-timeline)
8. [Documents & SharePoint](#8-documents--sharepoint)
9. [Alerts Engine](#9-alerts-engine)
10. [Audit Trail](#10-audit-trail)
11. [Compliance & Regulatory](#11-compliance--regulatory)
12. [Annual Service & Recurring Revenue](#12-annual-service--recurring-revenue)
13. [Insurance](#13-insurance)
14. [Goals, Risk & Fact Find](#14-goals-risk--fact-find)
15. [Investment & Portfolio (xplan API integration)](#15-investment--portfolio-xplan-api-integration)
16. [Reporting & Analytics](#16-reporting--analytics)
17. [Practice Management](#17-practice-management)
18. [Admin Console](#18-admin-console)
19. [Client Portal](#19-client-portal)
20. [External Integrations](#20-external-integrations)
21. [Security & Access Control](#21-security--access-control)
22. [Cross-cutting concerns](#22-cross-cutting-concerns)
23. [Cut-over preparation](#23-cut-over-preparation)

---

## 1. Foundation & Infrastructure

### Shipped
- ✅ **Next.js project setup with TypeScript** (Next ^16.2.3)
- ✅ **Azure-hosted database** (PostgreSQL via Prisma; Australia East)
- ✅ **Auth.js v5 (NextAuth)** with Azure AD
- ✅ **Prisma schema introspected from existing DB**
- ✅ **Vercel deployment pipeline** with auto-deploy from `main` (Vercel Pro tier as of 3 May 2026 for per-minute crons)
- ✅ **CRON infrastructure** (per-minute worker tick)
- ✅ **Microsoft Graph API connection** (outbound; secret rotated 29 Apr 2026 evening)
- ✅ **Project structure** (`src/lib`, `src/app`, `src/components`, etc.)
- ✅ **Migration management** via Prisma migrate
- ✅ **Tailwind v4** styling with `@theme` block in `globals.css` as design-token surface (decision 166)
- ✅ **Local Postgres test database with safety guard** *(shipped 28 Apr 2026, addendum 10, commit `14dca53`)*
- ✅ **Node runtime pin to 20.x** *(shipped 28 Apr 2026, addendum 10, commit `e753294`)*
- ✅ **Azure AI Speech (batch transcription) + Azure OpenAI gpt-4o** *(shipped 3 May 2026 across Round 4 prompts; AU East cutover commit `855a001`)* — both services on `arwm-openai-au` AIServices resource in Australia East. Standard tier deployment for data residency. Eastus retained ~1 week for rollback safety.
- ✅ **Durable async work queue (`processing_job`)** *(shipped 3 May 2026, addendum 15, commit `5e1d9ca`)* — generic queue with status/payload/attempts/scheduled_at; cron worker dispatches by job_type. Round 4 jobs: transcribe_recording, generate_file_note, extract_tasks, extract_facts.
- ✅ **Durable async chained-job pattern** *(shipped 3 May 2026, addendum 16)* — transcribe completion enqueues three sibling AI jobs (file note + tasks + facts); shared `maybeNotifyReviewReady` helper fires consolidated notification when all three terminal.
- ✅ **Brand typography wired (Poppins via next/font; ARWM tokens)** *(shipped 3 May 2026, addendum 16, commit `6260933`)*

### Not started — MVP / cut-over readiness
- 🔴 ⚪ **Background job service** for Graph webhook processing (Round 4 Prompt 9 / Teams webhook deferred to post-cut-over)
- 🔴 ⚪ **Azure Key Vault integration** for secrets
- 🟠 🔵 **Azure Container Apps deployment** *(promoted 3 May 2026 from "post-cut-over hardening" to cut-over readiness fast-follow within 2-3 weeks of cut-over per session conversation about latency and all-in-Azure tenant — see §23)*
- 🟠 ⚪ **Azure Communication Services or MessageNet API integration**
- 🟢 ⚪ **Performance testing with realistic data volume**
- 🟢 ⚪ **Disaster recovery / backup verification** procedures (formalised in §23 cut-over readiness)

---

## 2. Client Records

### Shipped
- ✅ **Core client schema** (`party`, `person`, `organisation` tables exist via baseline schema)
- ✅ **Basic client list and record screens** (existing in `/dashboard/clients`)
- ✅ **Production data integrity backfill** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Empty-string-to-null coercion utility (TU-4)** *(shipped 29 Apr 2026, addendum 11, commit `928b2c0`)*
- ✅ **Personal details capture (Round 2 Half A)** *(shipped 29 Apr 2026, addendum 11, commit `2a56c75`)*
- ✅ **`centrelink_detail` table (Round 2 Half A)** *(shipped 29 Apr 2026, addendum 11, commit `2a56c75`)*
- ✅ **`professional_relationship` table (Round 2 Half B)** *(shipped 29 Apr 2026, addendum 11, commit `ac0f5a0`)*
- ✅ **Estate fields on person + `estate_beneficiary` + `estate_executor` tables (Round 2 Half B)** *(shipped 29 Apr 2026, addendum 11, commit `ac0f5a0`)*
- ✅ **`power_of_attorney` table (Round 2 Half B)** *(shipped 29 Apr 2026, addendum 11, commit `ac0f5a0`)*
- ✅ **`super_pension_account` table (Round 2 Half C)** *(shipped 29 Apr 2026, addendum 11, commit `0d91d59`)*
- ✅ **Emergency contact / next of kin fields on `person`** *(shipped 1 May 2026, addendum 12, commit `e700e21`)* — 5 fields: name, relationship, phone, email, notes. Form surfacing in Half C.
- ✅ **Calendly intake creates person row + auto-household** *(shipped 1 May 2026, addendum 12, commit `329b969`)* — bug fix; intake previously stopped at party + contact_method.
- ✅ **Manual client create auto-household** *(shipped 1 May 2026, addendum 12, commit `ebe59a1`)* — `createDefaultHousehold` helper used by all client-create paths (decision 82).
- ✅ **Calendly intake populates `meeting_attendee` + `engagement.meeting_modality`** *(shipped 3 May 2026, addendum 16, commit `2e9ce2c`)* — structured attendee capture with adviser/client/prospect resolution by email; modality parsed from Calendly location field. Resolves TD #106.
- ✅ **Parked-fact counter + read-only list page on client record** *(shipped 3 May 2026, addendum 16, commit `4ef4178`)* — header counter + `/clients/[id]/parked-facts` list. Editing/migrating parked facts is future-round work per decision 160.
- ✅ **Client record section heading legibility (brand-correct typography)** *(shipped 3 May 2026, addendum 16, commit `6260933`)* — Midnight green at base size, medium weight; brand colour tokens in Tailwind v4 `@theme` block.

### Partial
- 🟡 **Client record screen** — Round 3 ✅ COMPLETE. Compact header + expandable sections + timeline-led layout + quick-add modals (+ Phone Call, + Meeting, + Note) + Half C section/row modals for Personal, Household + dependants, Professional, Estate (will + executors + beneficiaries + PoA), Super, Centrelink. Adviser-facing forms cover all Round 2 schema. Round 4 added file-note review screen and parked-facts surface. Open polish/cleanup items: TD #95 (relation enum needs grandchild), TD #96 (row-modal duplication), TD #97 (currency helper extraction), TD #99–103 (schema gaps surfaced during build).

### Not started — MVP / cut-over
- 🔴 ⚪ **Contact methods management** (`contact_method` table; multiple email/phone numbers per client; preferred-contact flag)
- 🔴 ⚪ **Address management** (`address` table; multiple addresses per client; primary/postal distinction)
- 🔴 ⚪ **Client search and filter** — Round 5; per decision 76, dependants filtered out of default list
- 🟠 ⚪ **Client identification documents** — *scope pending AML research, tech debt #85*
- 🟠 ⚪ **Tax File Numbers** *(deferred; see sensitive-credentials note below)*
- 🟠 ⚪ **Sensitive-credentials infrastructure (TFN + Macquarie PINs + HINs + "Important information" page)** *(scope expanded 29 Apr 2026, Alex conversation, addendum 11)* — supersedes the original "TFN encryption + reveal" deferred item from decision 65 / tech debt 75. Single `sensitive_credential` table; encrypted at rest, click-to-reveal, audit-trail-logged.
- 🟠 ⚪ **Beneficiary nominations** capture and display
- 🟢 ⚪ **Client photos / avatars** (low priority)

---

## 3. Households & Relationships

### Shipped
- ✅ **Schema exists** (`household_group`, `relationship` tables in baseline)
- ✅ **Household salutation, address-title, notes (Round 2 Half A)** *(shipped 29 Apr 2026, addendum 11, commit `2a56c75`)*
- ✅ **Dependant capture via `household_member` extension (Round 2 Half A)** *(shipped 29 Apr 2026, addendum 11, commit `2a56c75`)* — per decision 75
- ✅ **Household management UI** *(shipped 2 May 2026, addendum 14, Half C Prompt 3, commit `95599b4`)* — HouseholdSectionModal for salutation/address-title/notes; DependantModal for create/edit dependant rows; DependantDeleteConfirm for soft delete; adults render as click-through links to their own records. Decisions 106–110.

### Not started — MVP / cut-over
- 🔴 ⚪ **Relationship types** seed data
- 🟠 ⚪ **Household aggregate views**
- 🟠 ⚪ **Cross-household relationships**
- 🟢 ⚪ **External relationships** — partly addressed by Round 2 `professional_relationship` (UI now live per Half C Prompt 4)

---

## 4. Lifecycle & Service Tiers

### Shipped
- ✅ **Lifecycle stages** modeled
- ✅ **Lifecycle CHECK constraint** widened in 43b.1
- ✅ **Lifecycle transitions** wired into engagement closure
- ✅ **Client types** schema

### Not started — MVP / cut-over
- 🔴 ⚪ **Client type assignment UI**
- 🟠 ⚪ **Lifecycle stage manual override** (TU-1)
- 🟠 ⚪ **Lapsed/won-back handling**
- 🟢 ⚪ **Service tier pricing/fees** linkage

---

## 5. Engagements & Workflow Engine

### Shipped — full prospect-to-client lifecycle
- ✅ **Workflow engine foundation** (`workflow_template`, `workflow_instance`, `workflow_event` tables — 43a)
- ✅ **Phase ordering and lifecycle stage mapping** (43b.1)
- ✅ **Journey card outcome model** (43c.3b)
- ✅ **Initial Contact phase** (four-state — 43c.3a/4)
- ✅ **Initial Meeting phase** (four-state — 43c.3d, commit `3e98fbe`)
- ✅ **Discovery phase** (off-chain, four-state — 43c.3e)
- ✅ **Engagement phase migration** (43c.3f Half A, commit `1665281`)
- ✅ **Advice phase migration** (seven-state, traffic-light urgency — 43c.3f Half B, commit `cf576c8`)
- ✅ **Implementation phase migration** (43c.3f Half C, commit `24329e9`)
- ✅ **Off-chain spawning helper** (43c.3e)
- ✅ **Closure primitive** (43c.3e)
- ✅ **Shared derivation module** (43c.3f Half A)
- ✅ **Nudge engine cron generalization** (43c.3f Half A)
- ✅ **Calendly webhook integration** (extended 3 May 2026 to populate `meeting_attendee` and `engagement.meeting_modality`)
- ✅ **Auto-send-on-entry email pattern**
- ✅ **Driver-action email pattern**
- ✅ **Manual outcome recording**
- ✅ **`closing` workflow_template removed** *(shipped 28 Apr 2026, addendum 10, decision 60)*
- ✅ **`engagement.meeting_modality` enum** *(shipped 3 May 2026, addendum 15, Round 4 Prompt 2)* — in_person / phone / teams / other
- ✅ **`meeting_attendee` table** *(shipped 3 May 2026, addendum 15, Round 4 Prompt 2; populated by Calendly intake from Prompt 4.2)*

### Partial — workflow templates inventory
- 🟡 **`ninety_day_recap`** — exists in DB, real but not migrated to four-state (TU-2 — open)

### Not started — MVP / cut-over
- 🟠 ⚪ **Annual Review workflow** — Round 7
- 🟠 ⚪ **SOA workflow** as its own templated sequence
- 🟠 ⚪ **ROA workflow**
- 🟠 ⚪ **Insurance review workflow**
- 🟠 ⚪ **Ad-hoc workflow**
- 🟠 ⚪ **Workflow step templates** beyond four-state pattern
- 🟢 ⚪ **Workflow analytics**

### Open tech debt directly relevant to engine
- See addendums 4–7 for full list. Highlights: 52, 56, 60, 61, 64, 73 (`workflow_event` redundant)

---

## 6. Communications

### Shipped
- ✅ **EmailTemplate table** with body + subject + merge fields
- ✅ **Email merge fields system**
- ✅ **Microsoft Graph outbound email** (verified working post-rotation)
- ✅ **Email templates for:** IC booking link, IM booking link, Discovery booking link, engagement doc, Advice booking link, authority to proceed, Calendly confirmations
- ✅ **Round 4 outbound email — file-note review-ready / generation-failed notifications** *(shipped 3 May 2026, addendum 16, Prompts 8 + 10)* — reuses existing Graph helper.
- ✅ **In-app browser recorder + SharePoint chunked upload** *(shipped 3 May 2026, addendum 15, commit `b8bad37`)* — record/pause/resume/stop on client file; uploads on stop via Graph chunked-upload to dedicated SharePoint Meetings folder.
- ✅ **Azure AI Speech batch transcription pipeline with diarisation** *(shipped 3 May 2026, addendum 15, commits `ec1346a` + `cd137b5`)*
- ✅ **AI file-note generation pipeline (gpt-4o, humanised narrative, v1 prompt)** *(shipped 3 May 2026, addendum 16, commit `ba44a3d`)*
- ✅ **AI task extraction (us/client owner; type/subtype suggestion; tickbox review)** *(shipped 3 May 2026, addendum 16, commit `97220ac`)*
- ✅ **AI fact extraction with three-state confirm UX (Update/Park/Drop)** *(shipped 3 May 2026, addendum 16, commit `4ef4178`)* — schema-aware targeting via `extractable-facts` constants; conflict surfacing for fields with existing values; parked_fact rows for park-only categories per decision 160.
- ✅ **Adviser review screen with editable transcript, draft, speaker rename (Calendly prefill), regenerate, publish** *(shipped 3 May 2026, addendum 16, commit `9075c60`)* — at `/clients/[id]/file-notes/[fileNoteId]/review`; full audit trail capturing AI draft vs published content.

### Partial
- 🟡 **Teams meeting recording handling** — manual recording upload via the in-app recorder works for Teams meetings. Automatic Teams Graph webhook (Prompt 9) deferred to post-cut-over polish.

### Not started — MVP / cut-over
- 🔴 ⚪ **AI communication generation**
- 🔴 ⚪ **Outbound email from any client record**
- 🔴 ⚪ **Inbound email webhook**
- 🔴 ⚪ **Outbound SMS** via MessageNet (or Azure Communication Services)
- 🔴 ⚪ **Inbound SMS handling**
- 🔴 ⚪ **Teams Graph webhook for recording-completed events** *(deferred Round 4 Prompt 9; post-cut-over)* — replaces manual upload with automatic webhook-triggered pipeline.

### Not started — Cut-over
- 🟠 ⚪ **Configurable file-note prompt via .md file** *(Round 4 Future, post-cut-over)* — adviser-editable prompt steering AI's file-note voice/style.
- 🟠 ⚪ **Realtime transcription during meetings** — Round 4 was post-meeting only; revisit if real usage shows the value.
- 🟢 ⚪ **Per-user notification preferences** — currently all channels (bell + email + dashboard) fire for all advisers on every notification.
- 🟢 ⚪ **Live notification push (websocket / SSE)** — replaces 30s focus-poll bell update.
- 🟢 ⚪ **Aggregated daily digest emails** — currently each completion fires its own email.
- 🟢 ⚪ **QuickAddNoteModal extension to write file_note** *(decision 156; deferred from 5b)* — manual file_note creation without any recording, if real-usage signal calls for it.

---

## 7. Unified Timeline

### Shipped (Round 3 Half A — addendum 12)
- ✅ **`timeline_entry` schema and ingestion writes** *(shipped 1 May 2026, addendum 12)* — schema introduced with multi-actor entries, attachments, source/external_ref for xplan compatibility.
- ✅ **Historical backfill** *(shipped 1 May 2026, addendum 12)* — 47 rows backfilled.

### Shipped (Round 3 Half B — addendum 12)
- ✅ **GET `/api/clients/[id]/timeline`** *(shipped 1 May 2026, addendum 12, commit `351ca27`)* — paginated, filtered, searchable.
- ✅ **GET `/api/timeline-entries/[id]`** *(shipped 1 May 2026, addendum 12, commit `351ca27`)* — single-entry detail with attachments.
- ✅ **Compact header + expandable sections layout** *(shipped 1 May 2026, addendum 12, commit `3e9efa0`)* — replaces left-sidebar + tab structure with single-column timeline-dominant layout.
- ✅ **`ClientTimeline` component** *(shipped 1 May 2026, addendum 12, commit `952793e`)*
- ✅ **Polish: humanise titles + hide internal IDs + actor name enrichment** *(shipped 1 May 2026, addendum 12, commit `cc29f97`)*

### Shipped (Round 3 Half B Prompt 5 + Half C — addendums 13 + 14)
- ✅ **Quick-add modals (+ Phone Call, + Meeting, + Note)** *(shipped 1 May 2026, addendum 13, commit `3f5f199`)*
- ✅ **Per-section modal edit pattern** *(shipped 2 May 2026, addendum 14, commit `9b2ece1`)*
- ✅ **Household section + dependant management** *(shipped 2 May 2026, addendum 14, commit `95599b4`)*
- ✅ **Professional relationships CRUD** *(shipped 2 May 2026, addendum 14, commit `b42f244`)*
- ✅ **Estate section (Will & funeral + Executors + Beneficiaries + PoA)** *(shipped 2 May 2026, addendum 14, commits `0e42414` + `ae81c79`)*
- ✅ **Super & pensions CRUD** *(shipped 2 May 2026, addendum 14, commit `f9c3f98`)*
- ✅ **Centrelink section** *(shipped 2 May 2026, addendum 14, commit `f37f1d7`)*

### Shipped (Round 4 — addendums 15 + 16)
- ✅ **File note rendering on timeline (with draft/published distinction)** *(shipped 3 May 2026, addendum 16, commit `9075c60`)* — draft file_notes show "Draft - review needed" badge with click-through to review screen; published file_notes render as standard timeline entries. Round 4 Prompt 5b extends `ClientTimeline.tsx`.

### Not started — MVP / cut-over (post-Round-4)
- 🔴 ⚪ **Annotation on any entry** — deferred Round 3 follow-on.
- 🟠 ⚪ **Side-panel for editing entries** — view-only currently; edit/delete needs care around audit trail.
- 🟠 ⚪ **HTML email body rendering** in expanded view — currently plaintext-extracted (decision 85).
- 🟠 ⚪ **Virtual scrolling** for clients with >500 entries — not needed yet; native scrolling on paginated 50-row pages handles current scale.
- 🟢 ⚪ **xplan file note bulk import** — separate later piece. Schema (`source` + `external_ref`) already accommodates it; the import script itself is the work.
- 🟢 ⚪ **File note categories**
- 🟢 ⚪ **Action-required workflow**

**Round 3 design principle (from Alex conversation):** the "medical receptionist" model — basic info + audit-revealable sensitive numbers + documents/authorities are surfaced prominently. Income/assets/financials are accessible but not at first glance. Layout reflects this; permission-based role hiding deferred (decision 86) — for now all users with client-record access see everything.

**Round 4 source-preservation principle (decision 164):** every AI-extracted fact carries an unbroken chain back to the source recording. structured field / parked_fact / dropped audit entry → file_note → meeting_transcript → recording_url. Future-round parked-fact adoption preserves the chain. Models the ancestry.com hint pattern (source artifact always reachable).

---

## 8. Documents & SharePoint

### Shipped
- ✅ **SharePoint Graph chunked-upload (recordings)** *(shipped 3 May 2026, addendum 15, commit `b8bad37`)* — dedicated `arwm.sharepoint.com/sites/ARWMNewSite/Meetings` folder. Per-client folder resolver currently a stub (TD #105) until cowork-agents output ships.

### Not started — MVP
- 🔴 ⚪ **SharePoint folder structure** per client (locked taxonomy: ID & KYC Docs · Super · Investments · Insurance · Legal · Accountant and Tax · Advice Docs · Engagement, Renewal and ATP Docs · Recordings and Transcripts · Centrelink · Lending — Andrew + cowork-agents)
- 🔴 ⚪ **Document upload from Concilio** (general purpose; recordings already covered)
- 🔴 ⚪ **Document filing categories**
- 🔴 ⚪ **Automated scan webhook**
- 🔴 ⚪ **Document access from Concilio**
- 🔴 ⚪ **To-be-printed folder + dashboard alert surfacing** *(added 29 Apr 2026, Alex conversation, addendum 11)*
- 🔴 ⚪ **Form filling capacity (bidirectional)** *(added 29 Apr 2026, Alex conversation, addendum 11)*
- 🟠 ⚪ **Document version tracking** (`document_version` table exists in baseline)
- 🟠 ⚪ **Document templates** for system-generated docs
- 🟢 ⚪ **OCR / search within documents**
- 🟢 ⚪ **Bulk document operations**
- 🟢 ⚪ **Super-fund summary scan-in / OCR** *(added 28 Apr 2026, expanded 29 Apr 2026 addendum 11, tech debt 81)*
- 🟢 ⚪ **External folder sharing for accountants** *(added 29 Apr 2026, Alex conversation, addendum 11)*

---

## 9. Alerts Engine

### Shipped
- ✅ **`alert_instance` table** *(shipped 28 Apr 2026, addendum 10, Round 1 Half C, commit `12e885c`)*
- ✅ **Field-change alert detection** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Admin alerts page at `/admin/alerts`** *(shipped 28 Apr 2026, addendum 10, commit `a27bce0`)*
- ✅ **Acknowledge action wraps audit middleware** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Designated alert-fields config** at `src/lib/audit-config.ts` *(shipped 28 Apr 2026, tech debt 71)*
- ✅ **Round 2 alert-field extensions** *(shipped 29 Apr 2026, addendum 11)* — `centrelink_detail.crn`, `power_of_attorney.first_name`/`surname`, `estate_executor.first_name`/`surname`, `super_pension_account.provider_name`/`member_number`
- ✅ **Per-user alert routing** *(shipped 3 May 2026, addendum 16, commit `af488cd`)* — `alert_instance.recipient_user_id` + `cleared_at` columns; partial unique index on (subject_type, subject_id, alert_type) where cleared_at IS NULL.
- ✅ **Bell icon + per-user unread count + dropdown in app header** *(shipped 3 May 2026, addendum 16, commit `af488cd`)* — `src/components/layout/Topbar.tsx`. Polls every 30s while window focused; live push deferred.
- ✅ **`file_note_review_outstanding` alert type** *(shipped 3 May 2026, addendum 16, commit `af488cd`)* — fires when transcript-derived file_note has all three sibling AI jobs terminal AND generate_file_note succeeded; clears on publish.
- ✅ **`file_note_generation_failed` alert type** *(shipped 3 May 2026, addendum 16, commit `6260933`)* — fires when generate_file_note fails terminally; resolves TD #116.

### Partial
- 🟡 **Contact details changed alerts** — covered for email/mobile/postal address; not yet for other contact fields

### Not started — MVP
- 🔴 ⚪ **`alert_definition` table** — promote when full alerts engine lands
- 🔴 ⚪ **Alert evaluation engine** (background job, daily + on field change). Scope expanded 29 Apr 2026 (Alex conversation): also includes the **pre-meeting intelligence** pattern — when a client has an upcoming meeting on the calendar, the system runs a checklist (ID expiry, authority age, data freshness on assets/contact details, Centrelink data) and surfaces what needs attention.
- 🔴 ⚪ **Alert types from Stage 1 spec §530-538:** ID document expiring/expired; review due/overdue; workflow step overdue
- 🔴 ⚪ **Alert display in nav and client header** (bell partly covers this; full client-header alert count is its own item)
- 🔴 ⚪ **Timeline entries of type `alert`**
- 🟠 ⚪ **Alert routing by role**
- 🟠 ⚪ **Alert definition management UI** (*tech debt 71*)
- 🟠 ⚪ **Alert escalation** (*tech debt 70*)
- 🟢 ⚪ **Custom alert definitions** by practice

---

## 10. Audit Trail

### Shipped (Round 1 — addendum 10)
- ✅ **`audit_event` table extended** *(shipped 28 Apr 2026, addendum 10, commit `5a9d906`)*
- ✅ **Audit middleware wrapper** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **All 38 mutating route handlers wrapped** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Action types** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Before/after state snapshots as JSONB** *(shipped 28 Apr 2026, addendum 10, decision 58)*
- ✅ **No DELETE/UPDATE on audit_event** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Failed login logging** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Round 2 mutation coverage** *(shipped 29 Apr 2026, addendum 11)*
- ✅ **Round 4 mutation coverage** *(shipped 3 May 2026, addendum 16)* — file_note publish events with `had_adviser_edits` flag; field-update audit events for AI fact updates fire through existing field-change pattern; task accept/reject decisions captured in `task_publish_decisions` JSONB; fact accept/park/drop decisions captured in `fact_publish_decisions` JSONB.

### Partial
- 🟡 **VIEW_SENSITIVE event for sensitive-credentials access** — pattern built; will be exercised by sensitive-credentials infrastructure work (see §2)

### Not started
- 🟠 ⚪ **Audit trail UI — practice-wide view** (*tech debt 68*)
- 🟠 ⚪ **Audit trail UI — per-client view** (*tech debt 68*)
- 🟠 ⚪ **Audit search and filter** (*tech debt 68*)
- 🟠 ⚪ **Diff visualisation** (*tech debt 69*)
- 🟢 ⚪ **Audit export** (compliance/legal requests)

---

## 11. Compliance & Regulatory

### Shipped
- ✅ **Schema exists** (`compliance_register`, `consent`, `verification_check` tables in baseline)
- ✅ **PEP risk flag (Round 2 Half A)** *(shipped 29 Apr 2026, addendum 11, commit `2a56c75`)*
- ✅ **Estate planning capture (Round 2 Half B)** *(shipped 29 Apr 2026, addendum 11, commit `ac0f5a0`)*

### Not started — MVP / cut-over
- 🔴 ⚪ **AML / KYC research** *(added 29 Apr 2026, Alex conversation, tech debt #85)*
- 🔴 ⚪ **KYC verification capture** (`verification_check` rows for each ID document) — *shape pending AML research outcome*
- 🔴 ⚪ **Best Interests Duty evidence** (linking advice records to fact-finds, goals, recommendations)
- 🔴 ⚪ **Consent management**
- 🟠 ⚪ **Conflicts of interest register**
- 🟠 ⚪ **Complaints register**
- 🟠 ⚪ **AFSL / licensing record-keeping**
- 🟠 ⚪ **Continuing professional development tracking**
- 🟠 ⚪ **Regulatory reporting**
- 🟠 ⚪ **Compliance posture document** *(added 3 May 2026, addendum 16; cut-over readiness — see §23)* — short written record of where data lives, access controls, backup posture, incident response, data classification, audit trail capabilities.
- 🟢 ⚪ **Compliance Manager integration**
- 🟢 ⚪ **AI-assisted compliance review**

---

## 12. Annual Service & Recurring Revenue

### Shipped
- ✅ **`review_cycle` table** in baseline schema
- ✅ **`completed_with_annual_service` vs `completed_setup_only` distinction**

### Not started — MVP / cut-over (Round 7)
- 🔴 ⚪ **Annual review scheduling**
- 🔴 ⚪ **Annual Review workflow template**
- 🔴 ⚪ **Ongoing service agreement tracking**
- 🔴 ⚪ **Fee Disclosure Statement / renewal notices** — annual regulatory requirement (AU)
- 🔴 ⚪ **Client opt-in renewals** — annual regulatory requirement (AU)
- 🔴 ⚪ **Pre-meeting intelligence integration** *(scope-anchored 29 Apr 2026, Alex conversation, addendum 11)*
- 🟠 ⚪ **Service package definitions**
- 🟠 ⚪ **Recurring fee tracking**
- 🟠 ⚪ **Annual review trigger to nudge engine**
- 🟢 ⚪ **Multi-year service planning**

---

## 13. Insurance

### Shipped
- ✅ **`insurance_policy` table exists in baseline schema**

### Not started — MVP / cut-over
- 🔴 ⚪ **Insurance policy capture** — ❌ deferred for Concilio per Andrew; xplan retains insurance via licence
- 🟢 ⚪ **Insurance quoting**
- 🟢 ⚪ **Policy management** (claims, variations)
- 🟢 ⚪ **Insurer integration APIs**
- 🟢 ⚪ **Migrate parked facts (insurance_policies category)** *(added 3 May 2026, addendum 16, decision 160)* — when this round eventually runs, surface `parked_fact` rows in the `insurance_policies` category for adviser review against current state. Adviser confirms relevance, edits as needed, migrates into `insurance_policy` rows. `parked_fact.migrated_to_table` + `migrated_to_id` track the link. Source preservation chain (file_note → transcript → recording) preserved through migration per decision 164.

---

## 14. Goals, Risk & Fact Find

### Shipped
- ✅ **`goal` table exists in baseline schema**
- ✅ **`parked_fact` table** *(shipped 3 May 2026, addendum 15, commit `440d95b`)* — holds AI-extracted facts without schema homes; future-round adoption pattern.
- ✅ **AI fact extraction from transcripts (the 15-min call and initial meeting BECOME the fact-find)** *(shipped 3 May 2026, addendum 16, commit `4ef4178`, decision 152)* — schema-aware Update / Park / Drop UX on the file-note review screen. Replaces standalone fact-find form workflow.
- ✅ **Super/pension capture (Round 2 Half C)** *(shipped 29 Apr 2026, addendum 11, commit `0d91d59`)* — partly addresses fact-find scope

### Not started — MVP / cut-over (Round 8 for goals)
- 🔴 ⚪ **Goals capture UI** — Round 8
- 🔴 ⚪ **Migrate parked facts (goals category)** *(added 3 May 2026, addendum 16, decision 160)* — Round 8 includes adoption of `goal`-category parked_fact rows into `goal` table rows.
- 🔴 ⚪ **Risk profile / risk tolerance assessment**
- 🔴 ⚪ **Risk profile categories**
- 🟡 **Fact find form** — superseded by Round 4 conversational fact extraction (decision 152). Standalone form not built; conversations become the fact-find.
- 🟠 ⚪ **Goal progress tracking** over time
- 🟠 ⚪ **Multi-goal prioritization**
- 🟢 ⚪ **AI-assisted fact find** ✅ functionally shipped via Round 4 (decision 152). Polish backlog: prompt v1.1 tuning post-cut-over (TD #115).
- 🟢 ⚪ **Risk profile re-assessment scheduling**

---

## 15. Investment & Portfolio (xplan API integration)

**Per Andrew: keeping 1 xplan licence open for investment management. Andrew also exploring Prosperity (28 Apr 2026, addendum 10) which can pull super fund and bank account info.**

### Shipped
- ✅ **`financial_account` table** in baseline schema
- ✅ **`external_link` table** with row type for xplan

### Not started — Cut-over
- 🟠 ⚪ **xplan API integration** — pull portfolio holdings
- 🟠 ⚪ **xplan API integration** — pull insurance policy data
- 🟠 ⚪ **Sync schedule**
- 🟠 ⚪ **Portfolio holdings display** within Concilio client record
- 🟠 ⚪ **Performance summary**
- 🟠 ⚪ **Prosperity integration option** *(noted 29 Apr 2026, Alex conversation, addendum 11)*
- 🟠 ⚪ **Migrate parked facts (investment_holdings category)** *(added 3 May 2026, addendum 16, decision 160)* — when investment round runs, surface `parked_fact` rows in `investment_holdings` category for adviser review. Adopt into `financial_account` rows with proper row matching.
- 🟢 ⚪ **Balance change alerts**
- 🟢 ⚪ **Fee register**

---

## 16. Reporting & Analytics

### Shipped
- (Nothing yet)

### Not started — Cut-over
- 🟠 ⚪ **Pipeline dashboard** — clients by lifecycle stage / phase
- 🟠 ⚪ **Active workflows view**
- 🟠 ⚪ **Recent nudge fires log**
- 🟠 ⚪ **Conversion metrics**
- 🟠 ⚪ **Adviser productivity**
- 🟠 ⚪ **Revenue & fees by client**
- 🟠 ⚪ **Standalone reports section (pick report → pick clients)** *(scope direction 29 Apr 2026, Alex conversation, addendum 11)*
- 🟢 ⚪ **Custom reports** (admin-defined queries)
- 🟢 ⚪ **Data export** (CSV, Excel)
- 🟢 ⚪ **Compliance reporting** dashboards
- 🟢 ⚪ **Time-in-stage analytics**

---

## 17. Practice Management

### Shipped
- ✅ **`practice` table** in baseline (single-firm system but multi-tenant ready)
- ✅ **Notification primitive (bell + count + dropdown)** *(shipped 3 May 2026, addendum 16, commit `af488cd`)* — seed of fuller practice-management dashboard.

### Not started — Cut-over
- 🟠 ⚪ **Practice-management dashboard expansion** — when expanded, build atop the bell primitive. Add: open-review queue, overdue-task surface, parked-facts maintenance view, recent-activity stream. Driven by real-usage feedback post-cut-over per polish discipline call (3 May 2026, addendum 16).
- 🟠 ⚪ **Fee structures** per service tier
- 🟠 ⚪ **Fee processing / billing**
- 🟠 ⚪ **Adviser book management**
- 🟠 ⚪ **Client transfer between advisers** (with audit)
- 🟠 ⚪ **Team workload view**
- 🟠 ⚪ **Task assignment**
- 🟢 ⚪ **Referral tracking**
- 🟢 ⚪ **Joint clients / succession planning**
- 🟢 ⚪ **Practice settings UI**

---

## 18. Admin Console

### Shipped (43c.5)
- ✅ **Read-only admin console at `/admin`** (commits `2879d17`, `aa6a4df`)
- ✅ **Admin auth gating** via `requireAdmin()` for `role === "owner"`
- ✅ **Templates list and detail views**
- ✅ **Email templates list and detail views**
- ✅ **Nudges list view**
- ✅ **Calendly event types view**
- ✅ **Driver actions inventory**
- ✅ **Constants view**
- ✅ **Users view** (read-only, role display)
- ✅ **Field-change alerts view at `/admin/alerts`** *(shipped 28 Apr 2026, addendum 10, Round 1 Half C, commit `a27bce0`)* — extended 3 May 2026 to render Round 4 alert types.

### Partial
- 🟡 **Admin auth** — accepts `owner` only

### Not started — Post cut-over (enhancement-pack)
- 🟠 ⚪ **Editing capability** for workflow templates
- 🟠 ⚪ **Editing capability** for email templates
- 🟠 ⚪ **Editing capability** for nudge cadences
- 🟠 ⚪ **Editing capability** for Calendly event mappings
- 🟠 ⚪ **Promote hardcoded constants** to schema-driven editable values
- 🟠 ⚪ **User management** (invite, role change, deactivate)
- 🟠 ⚪ **Practice settings**
- 🟢 ⚪ **Audit log of admin config changes**
- 🟢 ⚪ **Visual workflow builder**

---

## 19. Client Portal

**Stage 2 per original spec — entire section is post-cut-over.**

### Not started — Post cut-over
- 🟢 ⚪ **Client portal authentication**
- 🟢 ⚪ **Client document access**
- 🟢 ⚪ **Secure messaging** to adviser
- 🟢 ⚪ **Fact-find self-service**
- 🟢 ⚪ **Goal tracking** display
- 🟢 ⚪ **Annual review prep**
- 🟢 ⚪ **Document signing**
- 🟢 ⚪ **Portfolio view** (read-only, pulls from xplan API)

---

## 20. External Integrations

### Shipped
- ✅ **Calendly webhook integration** (multiple meeting types; extended 3 May 2026 to populate `meeting_attendee` and `engagement.meeting_modality`)
- ✅ **Microsoft Graph outbound email** (verified working post-rotation 29 Apr 2026 evening)
- ✅ **Microsoft Graph SharePoint chunked-upload** *(shipped 3 May 2026, addendum 15)* — recordings upload to dedicated Meetings folder on `arwm.sharepoint.com/sites/ARWMNewSite`.
- ✅ **Azure AI Speech batch transcription (with diarisation)** *(shipped 3 May 2026, addendum 15)*
- ✅ **Azure OpenAI gpt-4o (chat completions for file note + tasks + facts)** *(shipped 3 May 2026, addendum 16)*

### Not started — MVP
- 🔴 ⚪ **Microsoft Graph inbound email webhook** (per §6)
- 🔴 ⚪ **Microsoft Graph Teams recording-completed webhook** *(deferred Round 4 Prompt 9; post-cut-over)* — replaces manual Teams recording upload.
- 🔴 ⚪ **MessageNet SMS API** (per §6)
- 🔴 ⚪ **Monday.com bidirectional task sync** *(added 29 Apr 2026, Alex conversation, addendum 11; placeholder shipped Round 4 — `task.monday_sync_state='pending'` for "us" tasks; actual sync API integration is its own work)*

### Not started — Cut-over
- 🟠 ⚪ **Mailchimp two-way sync**
- 🟠 ⚪ **xplan API integration** (per §15)
- 🟠 ⚪ **DocuSign or alternative e-sign** (decision 33 deferred)
- 🟠 ⚪ **My Prosperity integration** *(added 29 Apr 2026, Alex conversation, addendum 11)*

### Not started — Post cut-over
- 🟢 ⚪ **Compliance Manager integration**
- 🟢 ⚪ **Elle integration**
- 🟢 ⚪ **Macquarie / platform integrations**
- 🟢 ⚪ **Accountant/solicitor portals**
- 🟢 ⚪ **Microsoft Entra sign-in log integration** *(added 28 Apr 2026, addendum 10, tech debt 72)*

---

## 21. Security & Access Control

### Shipped
- ✅ **Azure AD authentication** for all staff
- ✅ **Role column on `user_account`** (owner, adviser, etc.)
- ✅ **Admin gating** for `/admin/*` routes
- ✅ **Append-only enforcement on `audit_event`** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **LOGIN_SUCCESS / LOGIN_FAIL audit events** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **AI extraction sensitive-field exclusions** *(shipped 3 May 2026, addendum 16, decision 161)* — `person.mothers_maiden_name`, `person.is_pep_risk`, `person.pep_notes`, `centrelink_detail.crn`, address JSON excluded from AI extraction entirely. Adviser-set via existing forms; AI does not touch.
- ✅ **Data residency closed (all services in Australia East)** *(shipped 3 May 2026, addendum 16, commit `855a001`)* — Postgres, Microsoft Graph M365 tenant, Azure AI Speech, Azure OpenAI gpt-4o all on AU East. eastus retained ~1 week as rollback safety.

### Not started — MVP / cut-over readiness
- 🔴 ⚪ **Role-based access control** at API layer
- 🔴 ⚪ **Practice scope** in every query
- 🔴 ⚪ **Information-visibility-by-role at UI layer** *(scope direction 29 Apr 2026, Alex conversation, addendum 11)* — the "medical receptionist" model.
- 🔴 ⚪ **Sensitive-credentials reveal infrastructure** *(scope direction 29 Apr 2026, Alex conversation, addendum 11)* — see §2.
- 🟠 🔵 **Role-based permission gating (minimum viable: adviser-of-record vs admin)** *(promoted 3 May 2026 from decision 86 deferral to cut-over readiness — see §23)* — today every signed-in adviser sees every client.
- 🟠 ⚪ **External penetration test** *(added 3 May 2026, addendum 16; cut-over readiness — see §23)*
- 🟠 ⚪ **Session timeout configuration**
- 🟠 ⚪ **Failed login lockout / rate limiting**
- 🟠 ⚪ **Two-factor authentication verification** — likely already via Azure AD; explicitly verify before cut-over (see §23)
- 🟢 ⚪ **IP allow-listing** for sensitive operations
- 🟢 ⚪ **Read-only role behavior**

---

## 22. Cross-cutting concerns

### Shipped
- ✅ **Handover convention** — addendums, specs, prompts, tidy-up backlog, master build list. Documented and proven across multiple rounds.
- ✅ **Workspace verification gate** at start of every Codex prompt (tech debt 33)
- ✅ **Decisions ledger** — 167 decisions documented across handovers (numbering skipped 92–98 between addendums 13 and 14)
- ✅ **Tech debt ledger** — 117 items tracked
- ✅ **Tidy-up backlog** — TU-1 (open), TU-2 (open; closing template part resolved 28 Apr), TU-3 (open), TU-4 ✅ resolved 29 Apr commit `928b2c0`, TU-5 ✅ resolved 29 Apr evening
- ✅ **Handover framework document** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Project state snapshot document** *(shipped 28 Apr 2026, addendum 10)*
- ✅ **Migration sequencing rule** *(shipped 28 Apr 2026, addendum 10, decision 67, principle 46)*
- ✅ **Pre-migration FK-blocker check** *(shipped 28 Apr 2026, addendum 10, principle 47)*
- ✅ **Generic-error diagnostic principle** *(added 29 Apr 2026 morning, principle 48)*
- ✅ **Coding-decision autonomy principle** *(added 29 Apr 2026 evening, addendum 11, principle 49)*
- ✅ **Andrew-time-permitting pacing principle** *(added 1 May 2026, principle 50)*
- ✅ **Ship-and-iterate UI polish principle** *(added 1 May 2026, principle 51)*
- ✅ **Production-smoke-when-local-blocked principle** *(added 1 May 2026, principle 52)*
- ✅ **Single-instruction Codex format principles 53–55** *(added 3 May 2026, addendum 15)*
- ✅ **Conversation-to-build-list integration pattern** *(established 29 Apr 2026, Alex conversation)*
- ✅ **Vercel env vars + `.env.local` together with redeploy after for new integrations** *(decision 157, 3 May 2026, addendum 16)*

### Not started — anytime
- 🟢 ⚪ **Visual / UX polish pass** across the app once functional pieces are stable (deferred per polish discipline call 3 May 2026 — driven by real team feedback post-cut-over, not pre-empted)
- 🟢 ⚪ **Mobile-responsive design** verification
- 🟢 ⚪ **Keyboard shortcuts** for power users
- 🟢 ⚪ **Onboarding flow** for new staff joining the practice
- 🟢 ⚪ **In-app help / documentation**
- 🟢 ⚪ **Dashboard rewiring (Round 4 signal surfacing)** *(deferred 3 May 2026, addendum 16, polish discipline call)* — surface open file-note reviews, parked facts, overdue tasks. Wait for team feedback on what's useful vs noise.
- 🟢 ⚪ **Empty-state copy improvements across the app**
- 🟢 ⚪ **Wholesale recolour to brand palette** — brand sheet adopted for headings only (Prompt 10); app-wide recolour deferred.
- 🟢 ⚪ **Fact extraction prompt v1.1 tuning** *(TD #115; post-cut-over driven by 2 weeks of real-usage Drop/Park/Update rates)*

---

## 23. Cut-over preparation

**Section restructured 3 May 2026 (addendum 16). Tracks the full cut-over readiness workstream: pre-cut-over functional + parallel-track items, fast-follow infrastructure/security work within 2-3 weeks of cut-over, and post-cut-over polish backlog driven by real-usage feedback.**

### Pre-cut-over (must land before Wednesday)

**Functional:**
- ✅ Round 1 — Audit trail middleware
- ✅ Round 2 — Client record fields & schema
- ✅ Round 3 — Timeline-led client record UI (3 Halves complete)
- ✅ Round 4 — File notes + transcription pipeline + AU East cutover (Prompt 9 / Teams Graph webhook deferred to post-cut-over polish; manual recording upload covers Teams meetings)
- 🔴 ⚪ Round 5 — Client search (small)
- 🔴 ⚪ End-to-end smoke against a real adviser session — validates Round 4 against substantive transcripts (more substantial than the 30-second Anthony Soprano smokes)

**Parallel-track / Andrew action:**
- 🔴 ⚪ xplan data export → Concilio import (~3 coding sessions; v1 draft mapping in `concilio_xplan_import_mapping.md`)
- 🔴 ⚪ User accounts setup (Andrew via Azure AD)
- 🔴 ⚪ 2FA verification across all adviser accounts (Andrew via Azure AD)
- 🔴 ⚪ Folder taxonomy reconciliation (Andrew + cowork-agents; locked list agreed: ID & KYC Docs · Super · Investments · Insurance · Legal · Accountant and Tax · Advice Docs · Engagement, Renewal and ATP Docs · Recordings and Transcripts · Centrelink · Lending)
- 🔴 ⚪ AML process documentation (Andrew action; may add `person` schema fields)
- 🔴 ⚪ Localhost auth fix (TD #93; ~15 min)
- 🔴 ⚪ Custom domain decision and setup (e.g. `concilio.arwm.com.au` pointing at Vercel deployment) — five-minute setup once decided
- 🔴 ⚪ xplan license reduction sequencing (Andrew with Iress) — Andrew flagged keeping 1 seat alive for investment + portal until those are replaced
- 🔴 ⚪ Cut-over dry run — pick a small number of test clients, run the full export/import + adviser review workflow against them, verify nothing important got lost

### Cut-over readiness fast-follow (within 2-3 weeks of cut-over)

**Infrastructure:**
- 🟠 ⚪ **Container Apps migration** *(promoted from TD #30 "post-cut-over hardening" to cut-over readiness fast-follow per session conversation about latency and all-in-Azure tenant)* — move app runtime from Vercel (Washington DC) to Azure Container Apps (Australia East). Closes cross-region latency gap; consolidates all infrastructure inside the ARWM Azure tenant.
- 🟠 ⚪ **eastus AI resource cleanup** — remove rollback fallback once AU East has been stable for ~1 week. Delete eastus env vars from Vercel; remove fallback branches from `azureOpenAI.ts` and `azureSpeech.ts` wrappers; remove the region selector. See `docs/region-cutover.md`.

**Security & assurance:**
- 🟠 ⚪ **External penetration test** — engage external party. Scoped to functional surface area (auth flows, data access boundaries, file storage, AI pipeline data flow). Findings feed into a small remediation round before going wide on real client volume.
- 🟠 ⚪ **Compliance posture document** — short written record covering: where data lives (region, tenant, service), access controls (who sees what), backup posture (frequency, retention, restore drill cadence), incident response plan, data classification (PII vs advice content vs system data), audit trail capabilities. Audience: Andrew, AFSL audit, future hires. (Cross-references §11.)
- 🟠 ⚪ **Documented backup-restore drill** — exercise the Azure Postgres backup-restore path against a non-production target to verify restore actually works. Document the procedure, document the RPO/RTO observed, file as part of the compliance posture document.
- 🟠 ⚪ **Role-based permission gating (minimum viable)** *(decision 86 — was deferred; promoted 3 May 2026)* — adviser-of-record vs admin distinction at API layer. Today every signed-in adviser sees every client.

### Nice-to-have for cut-over (deferable)

- 🟠 ⚪ **Outbound SMS** — Andrew has flagged SMS connection as desirable but not blocking
- 🟠 ⚪ **Inbound email webhook** — gradual implementation post-cut-over per Andrew
- 🟠 ⚪ **Sensitive-credentials infrastructure** — TFN + Macquarie PINs + HINs reveal (per §2). Highly desirable for Alex's day-to-day workflow but cut-over can begin without it.
- 🟠 ⚪ **AML research outcome** — determines whether ID document capture is built before or after cut-over

### Post-cut-over polish (driven by real team feedback)

- 🟢 ⚪ **Dashboard rewiring** — surface Round 4 signals (open file-note reviews, parked facts, overdue tasks). Wait for team feedback on what's useful vs noise; don't pre-empt.
- 🟢 ⚪ **Visual polish sweep** — wholesale recolour from existing palette to brand colours (brand sheet adopted in Prompt 10 for headings only); empty-state copy improvements; iconography consistency on timeline.
- 🟢 ⚪ **Fact extraction prompt v1.1** (TD #115) — tune extraction posture against 2 weeks of real-usage Drop/Park/Update rates per decision 163 (bias toward more extraction with adviser as filter).
- 🟢 ⚪ **Teams Graph webhook (Round 4 Prompt 9)** — replace manual Teams recording upload with automatic webhook-triggered pipeline.
- 🟢 ⚪ **QuickAddNoteModal extension to write file_note** (decision 156) — manual file_note creation without any recording, if real-usage signal calls for it.
- 🟢 ⚪ **Per-user notification preferences** — some advisers want email, some don't; some want digest, some want immediate.
- 🟢 ⚪ **Live notification push** (websocket / SSE) — replaces 30s focus-poll bell update.
- 🟢 ⚪ **Realtime transcription during meetings** — out of scope for Round 4 (post-meeting only); revisit if real usage shows the value.
- 🟢 ⚪ **Configurable file-note prompt via .md file** (Round 4 Future) — adviser-editable prompt steering AI's file-note voice.
- 🟢 ⚪ **Monday.com API sync** (parallel-track) — actual integration that turns the existing `monday_sync_state='pending'` queue into created cards with bidirectional update.

### Not blocking cut-over (gradual implementation)

- 🟠 Pre-meeting intelligence (Round 7 territory)
- 🟠 Reports section as standalone (§16 redesign)
- 🟠 To-be-printed dashboard alerts (§8)
- 🟠 Form filling capacity (§8 — Georgia's work continues)
- 🟠 Information-visibility-by-role UI refinement
- 🟠 Monday.com bidirectional sync — placeholder shipped Round 4; actual API integration is automation rather than capability

**Principle: cut-over isn't "everything done"; it's "the floor is laid".** The 🔴 MVP items are the floor. Once Rounds 1–4 + Round 5 + the §23 required items are in place, xplan reduction can begin in parallel with the rest.

---

## Minimum Viable Cut-Over

Round-based ordering:

1. **Round 1 — Audit trail middleware** ✅ shipped 28 Apr 2026
2. **Round 2 — Client record additional fields & schema** ✅ shipped 29 Apr 2026
3. **Round 3 — Client record timeline-led UI** ✅ shipped 2 May 2026 (all three Halves complete)
4. **Round 4 — File notes + transcription pipeline** ✅ **shipped 3 May 2026** (Prompts 1–8, 10, 11; Prompt 9 deferred to post-cut-over polish)
5. **Round 5 — Client search** ⚪
6. **Round 6 — Document upload polish** ⚪
7. **Round 7 — Annual Review workflow + opt-in + pre-meeting intelligence** ⚪
8. **Round 8 — Goals capture (incl. parked-fact migration for goals category)** ⚪
9. **Round 9 — Information grouping refinements** ⚪

Plus §23 cut-over preparation parallel-track items.

After Round 7 lands, Concilio runs in parallel with xplan while day-to-day work moves over. Full cut-over likely needs further rounds beyond this list.

---

## Multi-contributor working pattern

Other people (or other AI sessions) can pick up sections in parallel. To integrate cleanly:

1. **Read first:** state snapshot + handover framework + most recent addendum + most recent conversation summaries + this master build list. The handover convention is the integration layer.
2. **Pick a section** marked ⚪ and not currently being worked on. Update its status to "🔵 in progress" with contributor name and date.
3. **Scope the round** following the established convention: spec file, prompts file (verification → Half A → Half B...).
4. **Use the workspace-verification gate** at the start of every Codex prompt (mandatory until tech debt 33 resolves).
5. **Halt-and-amend** when introspection surfaces material findings rather than building on broken assumptions.
6. **Ship as commits** with messages following the existing pattern.
7. **Update this document** when items ship: change ⚪ → ✅, add commit reference and ship date inline.
8. **Add to addendums** at session end with the standard structure per the handover framework.

**Contention:** if two contributors pick the same area, coordinate via the master document's "in progress" markers. First-claim wins.

---

## Changelog

### Version 9 — 3 May 2026 (addendum 16)

Round 4 COMPLETE. Eight prompts shipped this session (4.2, 5a, 5b, 6, 7, 8, 10, 11) on top of addendum 15's seven (1, 2, 2.1, 2.1.1, 3, 4, 4.1). Round 4 marked ✅ in cut-over sequence. Prompt 9 (Teams Graph webhook) deferred to post-cut-over polish — manual recording upload covers Teams meetings until then.

§1 Foundation: Azure AI services + durable async work queue + chained-job pattern + brand typography all marked shipped. Container Apps migration promoted from "post-cut-over hardening" (TD #30) to cut-over readiness fast-follow within 2-3 weeks of cut-over per session conversation about latency and all-in-Azure tenant.

§2 Client Records: Calendly intake → meeting_attendee + meeting_modality, parked-fact counter + read-only list page, and brand-correct heading legibility all shipped.

§5 Engagements: meeting_modality enum + meeting_attendee table marked shipped.

§6 Communications: AI file-note generation, task extraction, fact extraction with three-state UX, adviser review screen, in-app recorder + SharePoint chunked upload, Azure AI Speech batch transcription pipeline all marked shipped. Round 4 Future and post-cut-over polish items added (configurable file-note prompt, realtime transcription, per-user notification preferences, live notification push, daily digest emails, QuickAddNoteModal file_note extension).

§7 Unified Timeline: file note rendering with draft/published distinction marked shipped (Round 4 Prompt 5b). Round 4 source-preservation principle (decision 164) added.

§8 Documents & SharePoint: SharePoint Graph chunked-upload (recordings) marked shipped; folder taxonomy locked list noted.

§9 Alerts Engine: per-user alert routing, bell icon + unread count + dropdown, file_note_review_outstanding alert type, file_note_generation_failed alert type all marked shipped.

§10 Audit Trail: Round 4 mutation coverage marked shipped (file_note publish events, field-update audit events for AI fact updates, task_publish_decisions, fact_publish_decisions).

§11 Compliance: compliance posture document added as cut-over readiness item.

§13/14/15 (Insurance/Goals/Investments): "migrate parked facts" subtasks added to each per decision 160 (row-based schema tables are park-only in Round 4 v1; future rounds adopt).

§14 Goals/Risk/Fact Find: parked_fact table marked shipped; AI fact extraction marked shipped; standalone fact find form marked superseded by conversational extraction (decision 152).

§17 Practice Management: notification primitive marked shipped as seed; practice-management dashboard expansion noted as post-cut-over polish driven by real feedback.

§18 Admin Console: alerts view extended to render Round 4 alert types.

§20 External Integrations: SharePoint chunked-upload, Azure AI Speech, Azure OpenAI gpt-4o all marked shipped; Teams recording-completed webhook flagged as deferred Prompt 9.

§21 Security & Access Control: AI extraction sensitive-field exclusions (decision 161), data residency closed (all services in Australia East) both marked shipped. External penetration test added as cut-over readiness item. Role-based permission gating promoted from decision 86 deferral to cut-over readiness fast-follow.

§22 Cross-cutting: decision count updated to 167; tech debt count updated to 117. Decision 157 (Vercel env vars + .env.local + redeploy) added. Polish-discipline-driven items (visual sweep, dashboard rewiring, prompt v1.1 tuning) added as post-cut-over deferred per session conversation.

§23 Cut-over preparation: SUBSTANTIALLY RESTRUCTURED. Now organised as: pre-cut-over (functional + parallel-track Andrew action), cut-over readiness fast-follow within 2-3 weeks (Container Apps migration, eastus cleanup, pen test, compliance posture, backup-restore drill, role-based permissions), nice-to-have deferable, post-cut-over polish driven by real team feedback, not blocking cut-over (gradual). Custom domain setup added as new pre-cut-over Andrew action.

Decisions 156–167 added. Tech debt 113–117 added. TD #116 resolved (file_note_generation_failed alert path wired in Prompt 10). Today's line refreshed.

### Version 8 — 2 May 2026 (addendum 14)

Round 3 COMPLETE. Half C all 7 prompts shipped in a single session: Personal/Identity foundation + Address/Employment/Contact section modals (Prompt 2), Household + dependants (Prompt 3), Professional relationships (Prompt 4), Estate foundation + executors (Prompt 5a), beneficiaries + PoA (Prompt 5b), Super/pensions (Prompt 6), Centrelink (Prompt 7). §7 Unified Timeline gained a new "Shipped (Round 3 Half B Prompt 5 + Half C)" subsection covering all 8 commits. §3 Households & Relationships marks household management UI as shipped. §2 Client Records partial bucket updated to reflect Round 3 complete. §22 cross-cutting decision/tech-debt counts refreshed (140 decisions, 104 tech debt items). §23 cut-over preparation ticks Round 3 off; Round 4 added with spec reference. Minimum Viable Cut-Over section updated. Decisions 99-140 added (numbering skipped 92-98 inadvertently, not retroactively renumbered). Tech debt 95-104 added; nothing closed. Inspirational header refreshed to "The record now reads back what the firm knows. Next, what was said in the room."

### Version 7 — 1 May 2026 (addendum 13)

Round 3 Half B Prompt 5 shipped. §7 Unified Timeline gained a new "Shipped (Round 3 Half B Prompt 5)" subsection with the quick-add modals entry. §2 Client Records updated to mark Round 3 Half B as fully shipped. Half C (forms for Round 2 schema fields) moved from "Not started" to spec-drafted. §22 gained principle 52 (production-smoke-when-local-blocked escape hatch). §23 added localhost auth fix as a deferable cut-over item. Decisions 87-91 added. Tech debt 92-94 added. Inspirational header refreshed.

### Version 6 — 1 May 2026 (addendum 12)

Round 3 Half A fully shipped. §7 Unified Timeline largely rewritten — schema (`timeline_entry`, `timeline_attachment`) shipped; ingestion writes shipped; historical backfill ran (47 rows); entry types extended to include `phone_call`, `meeting`, `task`. Half B Prompts 1–4.5 all shipped: three API endpoints, restructured client record layout (compact header + expandable sections), new `ClientTimeline` component with humanised titles, hidden internal IDs, and human actor names. §2 gained 4 new shipped items: emergency contact fields on person, Calendly intake bug fix (now creates person + auto-household), manual create auto-household. Decisions 80–86 added. Tech debt 86–91 added; TD #79 closed. Principles 50 + 51 added (Andrew-time-permitting pacing; ship-and-iterate UI polish). Inspirational header refreshed.

### Version 5 — 29 April 2026 (post-evening-session, addendum 11 + Alex conversation integration)

Folded findings from the morning Andrew/Alex transcript into the build list. Five clean additions: emergency contact (§2), Monday.com bidirectional task sync (§20), Teams recording → AI transcription pipeline (§6, Round 4), to-be-printed folder + dashboard alerts (§8 + §9), form filling capacity (§8). Five scope/direction items recorded as items with appropriate flags: sensitive-credentials infrastructure expansion (§2 + §21), reports-section-as-standalone (§16), pre-meeting intelligence (§9 + §12), AML research (§11, tech debt #85), information-visibility-by-role UI principle (§21). Added §23 Cut-over preparation as a new section tracking discrete pre-cut-over items including user accounts/2FA verification and the xplan data export → Concilio import map. Added Prosperity integration noted (§15 + §20). Refreshed inspirational header.

### Version 4 — 29 April 2026 (post-evening-session, addendum 11)

Round 2 fully shipped across three Halves. §2 gained 7 new shipped items, §3 gained household salutation/notes and dependant capture, §11 gained PEP flag and estate planning schema, §9 gained Round 2 alert-field extensions, §10 gained Round 2 mutation coverage, §1 noted Microsoft Graph secret rotation, §22 marked TU-4 and TU-5 resolved and added principle 49. Tech debt 79–84 added. Decisions 73–79 added.

### Version 3 — 29 April 2026 (post-morning-office-session)

Added "Today's line" inspirational header. Added TU-4 and TU-5 to Cross-cutting tidy-up listing. No code changes.

### Version 2 — 28 April 2026 (addendum 10)

Round 1 shipped. §10 substantially complete. §9 alert_instance shipped. §18 alerts view. §21 append-only + login audit. §22 handover framework, state snapshot, migration sequencing rule, pre-migration FK-blocker check. Round 2 scoped.

New tech debt: 68–78. Resolved: closing workflow template deleted (decision 60).

Added document version metadata, inline date annotations, changelog.

### Version 1 — 28 April 2026 (addendum 9)

Initial creation. 22 sections. Status markers, cut-over priority markers, multi-contributor pattern.
