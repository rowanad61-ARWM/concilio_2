# Concilio project state snapshot

This is the **single source of truth for current project state**. Updated (not appended) each session. Read this first when picking up the project.

Last updated: 3 May 2026 (post-session, addendum 16)

---

## 1. Headline state

- **Current commit on `main`:** `855a001`
- **Round 1 status:** ✅ live in production. Audit middleware, field-change alerts, admin alerts page.
- **Round 2 status:** ✅ live in production.
- **Round 3 status:** ✅ live in production. Halves A, B, C all complete.
- **Round 4 status:** ✅ **COMPLETE.** Spec v3 locked (Q1–Q12). Prompts 1, 2, 2.1, 2.1.1, 3, 4, 4.1, 4.2, 5a, 5b, 6, 7, 8, 10, 11 shipped. Prompt 9 (Teams Graph webhook) deferred — manual recording upload covers Teams meetings until post-cut-over. End-to-end pipeline live in production on Australia East: recording → SharePoint → batch transcription with diarisation → AI draft + tasks + facts (sibling jobs) → adviser review UI → publish writes file_note + Task rows + parked_fact rows + audit_event in one transaction → notification fires (bell + email + dashboard alert) and clears on publish. Data residency loop closed.
- **Schema alignment:** Azure and GitHub `main` are in sync. No pending migrations either side.
- **Deployment:** `https://concilio-2.vercel.app` running latest. Vercel **Pro** tier. Last deploy green at `855a001`.
- **Active blockers:** None.
- **Cut-over target:** Wednesday morning per Andrew. ~22 hours of session time remaining for xplan import + Round 5 + parallel-track items.
- **Next concrete action:** End-to-end smoke against a real adviser meeting (or realistic synthetic recording) to validate Round 4 pipeline on substantive transcripts. Then xplan import. See pickup script in §7.

---

## 2. Infrastructure

### Code repository
- GitHub: `rowanad61-ARWM/concilio_2`
- Local path: `C:\Dev\concilio` (only working copy; stale `C:\Projects\concilio_2\concilio` should not be used)
- Branch: `main`
- Node engine pin: `20.x` in `package.json`. Andrew's local is `v24.14.1`; workspace verification gate accepts v20/v22/v24.

### Hosting (production app)
- Vercel: `https://concilio-2.vercel.app`
- **Vercel Pro tier** (per-minute crons; supports the worker tick frequency Round 4 needs)
- Auto-deploys from GitHub `main`
- Region: Washington DC (iad1)
- Build command: `next build` (does NOT run `prisma migrate deploy`)
- Long-term plan: migrate from Vercel to Azure Container Apps. **Promoted from TD #30 (post-cut-over) to cut-over readiness fast-follow** (within 2-3 weeks of cut-over) per session conversation about latency and all-in-Azure tenant. See master build list §23.

### Microsoft Graph (Azure App Registration)
- App ID: `44715142-3ce7-4b21-8d18-fcbb44dae5db`
- Used for: outbound email, SharePoint upload (Round 4), sign-in (NextAuth Microsoft Entra provider), Round 4 notifications.
- Client secret env var: `AZURE_CLIENT_SECRET`
- Status: rotated 29 Apr 2026; valid 24 months. Production has working value. **Local `.env.local` still out of sync — TD #93 active.**

### Azure AI services (Round 4)

Two resources now live, both AIServices kind:

- **`arwm-openai`** (eastus) — original; retained as rollback safety for ~1 week post-cutover.
- **`arwm-openai-au`** (australiaeast) — provisioned 3 May 2026. Active runtime.
  - `gpt-4o` deployment, model version `2024-11-20`, **Standard** tier (not Global Standard — chosen explicitly for data residency), capacity 50K TPM.
  - Speech batch transcription via the regional Cognitive Services endpoint (decision 167).
- Env vars in Vercel + `.env.local` (both regions): `AZURE_OPENAI_*`, `AZURE_OPENAI_AU_*`, `AZURE_SPEECH_*`, `AZURE_SPEECH_AU_*`. Wrappers (`src/lib/azureOpenAI.ts`, `src/lib/azureSpeech.ts`) prefer AU vars when set, fall back to eastus.
- Region cleanup scheduled ~1 week post-cutover: remove eastus env vars from Vercel; remove fallback branches from wrappers.

### Cron infrastructure
- `/api/jobs/process` runs every minute via Vercel cron
- Auth: `CRON_SECRET` env var in Vercel production
- Worker pattern: pick oldest queued `processing_job`, mark running, dispatch to handler, write result. One job per tick.

### Database — Azure (production + dev, shared)
- Azure Postgres
- Host: `concilio-db.postgres.database.azure.com`
- Region: **Australia East** (data residency clean for cut-over)
- DB name: `postgres`
- User: `concilio_admin`
- Connection: `.env.local` points here for both `npm run dev` and Vercel runtime

### Database — local (test only)
- PostgreSQL 18.3 on Andrew's Windows machine
- Host: `localhost:5432`
- DB name: `concilio_test`
- User: `concilio_dev` / password `concilio_dev_local`
- Safety guard at `test/setup-local-env.cjs` hard-fails any test run pointing at Azure
- Known issue: `concilio_dev` lacks `CREATEDB` privilege (TD #80, deferred)

### SharePoint (Round 4)
- Site: `https://arwm.sharepoint.com/sites/ARWMNewSite`
- Recordings folder: `Meetings` (subfolder of the site root for now)
- Upload pattern: Graph chunked-upload (`createUploadSession`) for files >4MB
- Per-client folder resolution: stub for now (TD #105); awaits cowork-agents folder taxonomy lock

### Migration sequencing rule (mandatory)
Schema changes go to Azure **before** GitHub. Principle 47: read-only "what would block this migration" check before any production migration.

### Prisma 7 env loading
`prisma.config.ts` auto-loads `.env.local` via dotenv. The `.env.test` (local test DB) still needs explicit loading via the existing PowerShell pattern.

---

## 3. Round status

**Master cut-over sequence:**
1. Round 1 — Audit trail middleware ✅ (28 Apr 2026)
2. Round 2 — Client record additional fields & schema ✅ (29 Apr 2026)
3. Round 3 — Client record timeline-led UI ✅ (1–2 May 2026)
4. Round 4 — File notes + Teams recording → AI transcription pipeline ✅ (3 May 2026)
5. Round 5 — Client search ⚪ (small, scoped to land alongside cut-over readiness work)
6. Round 6 — Document upload polish ⚪
7. Round 7 — Annual Review workflow + opt-in + pre-meeting intelligence ⚪
8. Round 8 — Goals capture (includes parked-fact migration) ⚪
9. Round 9 — Information grouping refinements ⚪

**Round 4 prompt status (final):**
- ✅ Prompt 1 — Verification (no commit; pure inventory)
- ✅ Prompt 2 — Schema migration (`5e1d9ca`)
- ✅ Prompt 2.1 — `parked_fact` schema (`440d95b`)
- ✅ Prompt 2.1.1 — `parked_fact` index correction (`4cbe3c1`)
- ✅ Prompt 3 — In-app recorder + SharePoint upload (`b8bad37`)
- ✅ Prompt 4 — Transcription pipeline (`ec1346a`, `42e5d79`)
- ✅ Prompt 4.1 — Restore 1-minute cron post Vercel-Pro (`cd137b5`)
- ✅ Prompt 4.2 — Calendly intake → meeting_attendee + meeting_modality (`2e9ce2c`)
- ✅ Prompt 5a — AI file-note generation pipeline backend (`ba44a3d`)
- ✅ Prompt 5b — Adviser review UI (`9075c60`)
- ✅ Prompt 6 — Task extraction + tick-box review (`97220ac`)
- ✅ Prompt 7 — Fact extraction + three-state confirm UI (`4ef4178`)
- ✅ Prompt 8 — Notification system (`af488cd`)
- ⚪ Prompt 9 — Teams Graph webhook (DEFERRED to post-cut-over per session decision; manual recording upload covers Teams meetings)
- ✅ Prompt 10 — Polish (brand typography + heading legibility + generation-failure alert) (`6260933`)
- ✅ Prompt 11 — Australia East provisioning + region cutover (`855a001`)

**Cut-over readiness items (in flight or pending):**
- xplan data export → Concilio import map (~3 coding sessions; draft mapping `concilio_xplan_import_mapping.md` v1)
- Round 5 (client search; small)
- Folder taxonomy reconciliation (Andrew working with cowork-agents)
- AML process documentation (Andrew action; may add fields to `person` schema)
- Localhost auth fix (TD #93; ~15 min when convenient)
- 2FA verification across all adviser accounts (Andrew action via Azure AD)
- Custom domain decision and setup (e.g. `concilio.arwm.com.au`) — small, ~5 min once decided
- Container Apps migration (promoted from TD #30 to fast-follow within 2-3 weeks of cut-over)
- External pen test (post-functional-completion, pre-going-wide-on-real-data)
- Compliance posture document (data classification, access controls, backup posture, incident response)
- Documented backup-restore drill against Azure Postgres
- Real end-to-end smoke against a real adviser session (validates Round 4 against substantive transcripts)

---

## 3a. Conversation-driven additions (carried)

Items from prior sessions' Andrew/Alex transcript. Status updated:

- **Emergency contact / next of kin** ✅ shipped (Round 3 Half C).
- **Monday.com bidirectional task sync** — placeholder shipped (Round 4 sets `monday_sync_state='pending'` for "us" tasks); actual sync API integration is its own parallel-track work.
- **Teams meeting recording → AI transcription → file note + extracted tasks** ✅ **shipped via in-app recorder + manual upload for Teams. Teams Graph webhook (Prompt 9) deferred.**
- **To-be-printed folder + dashboard alerts** — not started.

**Folder taxonomy locked** (parallel-track via cowork-agents):
ID & KYC Docs · Super · Investments · Insurance · Legal · Accountant and Tax · Advice Docs · Engagement, Renewal and ATP Docs · Recordings and Transcripts · Centrelink · Lending. No Annual Review folder (Concilio timeline does it). No Other folder (Centrelink + Lending split out).

---

## 4. Locked decisions (do not relitigate)

Decisions 1–155 carry forward.

**From this session (addendum 16):**

- **156** — Decision 155 (QuickAddNoteModal extension to write file_note) deferred from 5b. The editable draft pane on the review screen subsumes the discard-AI fallback. Manual-only file_note creation without any recording becomes a separate post-cut-over polish prompt if real-usage signal calls for it.
- **157** — Vercel env vars and `.env.local` are both required when adding new external service integrations. Both must be populated before any prompt that touches the new service runs in production. Redeploy required after adding Vercel vars.
- **158** — Task type/subtype are dynamic `TaskTypeOption` rows, not Prisma enums. AI extraction prompt receives them as runtime-resolved option list.
- **159** — `task.actor_side` and `task.monday_sync_state` populated by Round 4 publish flow only. Other Task creation paths leave both null. Correct interim.
- **160** — Row-based schema tables are PARK-ONLY in Round 4 v1 fact extraction. Future rounds (Goals/Insurance/Investments/etc.) include "adopt parked facts" with proper row-matching/creation UI as part of those rounds' build work.
- **161** — Sensitive identity/compliance fields excluded from AI extraction entirely. Excluded list: `person.mothers_maiden_name`, `person.is_pep_risk`, `person.pep_notes`, `centrelink_detail.crn`, address JSON. Adviser-set via existing forms.
- **162** — Employment is the one row-based table treated as covered, via "update latest active employment_profile row or insert" upsert rule.
- **163** — Fact extraction posture: AI extracts, adviser filters. Bias toward more extraction over time, with adviser as filter.
- **164** — Source preservation through fact lifecycle. Every AI-extracted fact carries an unbroken chain back to source recording. Future-round adoption preserves chain. Models the ancestry.com hint pattern.
- **165** — `maybeNotifyReviewReady` called from queue worker AFTER job status write, not from inside handler before return.
- **166** — Tailwind v4 with `@theme` block in `src/app/globals.css` is the design-token surface, NOT `tailwind.config.ts`.
- **167** — Azure Speech batch endpoint is `https://<region>.api.cognitive.microsoft.com/`, NOT the `stt.speech.microsoft.com` SDK endpoint. Portal labelling is misleading on this.

---

## 5. Tech debt log

Items 1–112 carry forward.

**Added this session:**

- **113** — Anthony Soprano test recording predates Prompt 4.2 Calendly intake; speaker prefill falls back to "Speaker 1" for that record.
- **114** — No shared Task creation helper; logic duplicated between `src/app/api/tasks/route.ts` and the publish handler.
- **115** — Fact extraction prompt v1.1 tuning. After 2 weeks of real-usage data, review extracted_facts vs fact_publish_decisions audit data and tune accordingly.
- **117** — Codex's smoke artifacts (`tmp-prompt*-*` files) should be swept at end of each prompt's smoke, not left in the working dir.

**Resolved this session:**
- **116** — `file_note_generation_failed` notification path. Added in Prompt 8 spec, implemented in Prompt 10.

**Still active and worth surfacing:**
- **TD #93** — Localhost auth `invalid_client` from out-of-sync local Azure client secret. Surfaces on every session as recorder mic + local Graph email block. ~15 min job. Worth doing pre-cut-over.

---

## 5a. Tidy-up backlog

**Open:**
- **TU-1** — Manual lifecycle stage override.
- **TU-2** — `ninety_day_recap` template still un-migrated to four-state.
- **TU-3** — Engagement rename.

---

## 6. Working principles

- **40** — Patches expected during implementation. Don't over-spec.
- **41** — Synthetic testing for low-frequency flows.
- **42** — Tidy-up backlog kept separate from rounds.
- **43** — Tight responses. Single questions per turn. Get-on-with-it bias.
- **44** — Claude designs; Codex builds; Andrew watches and answers when asked.
- **45** — Claude has no filesystem access. Information flows through chat only.
- **46** — Schema changes go to Azure before GitHub.
- **47** — Pre-migration FK-blocker check before any production migration.
- **48** — When a handler returns a generic error string, check Vercel runtime logs for the actual stack trace before guessing.
- **49** — Claude makes coding decisions autonomously; only surfaces them when they affect usability, scope, or visible behaviour. Andrew is headline designer, not coder.
- **50** — Pace governed by Andrew's available time, not a target date.
- **51** — Once a UI surface is functional and defensible, ship it and let real usage drive polish prompts.
- **52** — Production smoke is acceptable when local environment issues block dev-server smoke, *provided* the change is build-green, UI-only (no schema, no destructive operations), and a revert is one commit away.
- **53** — When Claude needs Codex to do something, Claude provides the exact paste-ready instruction.
- **54** — When Claude needs information from Codex, Claude provides the exact paste-ready prompt.
- **55** — All Codex pastes go in code blocks (triple backticks). All commit messages go in code blocks.

**Operational patterns continuing from prior sessions:**

- **Single-instruction commit prompts** continue to work cleanly. Paragraph form: "Stage these N files. Commit with message in next code block. Push. Wait for Vercel green. Report SHA + status. Stop only after push lands."
- **ASCII-only commit messages.** Em-dashes (—) and arrows (→) get mangled by Windows Git encoding. Use `-` and `->` instead.
- **All execution sits inside Codex** (or Vercel/Azure executed via Codex). Claude does NOT give Andrew direct execution instructions.
- **Verify pastes arrived intact.** Two paste-truncation incidents this session (4.2 commit message, prior session's 2.1 indexes). Long pastes can clip; visual eyeball before sending is cheap insurance.
- **Vercel env vars + `.env.local` together; redeploy after.** Decision 157 codifies what bit us twice this session. New external service integration = both environments populated + Vercel redeploy before any prompt that touches it runs.

---

## 7. Pickup script (current) — instructions for next session

> "Resuming Concilio. Read in this order: `Handovers/concilio_state_snapshot.md` (this doc) → `Handovers/concilio_addendum_16.md` → `Handovers/concilio_round4_spec.md` (reference; Round 4 complete) → `Handovers/concilio_round4_prompts.md` (reference) → `Handovers/concilio_master_buildlist.md` → `Handovers/concilio_xplan_import_mapping.md`. Latest commit on `main` is `855a001`.
>
> **Round 4 is COMPLETE.** All planned prompts (1–8, 10, 11) shipped. Prompt 9 (Teams Graph webhook) deferred — manual recording upload covers Teams meetings until post-cut-over. End-to-end pipeline live in production on Australia East infrastructure: recording → SharePoint → batch transcription with diarisation → AI draft + tasks + facts (sibling jobs) → adviser review UI with three-state fact confirm (Update/Park/Drop) → publish writes file_note + Task rows + parked_fact rows + audit_event in one transaction → notification (bell + email + dashboard alert) clears on publish.
>
> **Andrew's stated cut-over target: Wednesday morning** with ~22 hours of session time remaining for the run-up. Achievable but not generous.
>
> **Next concrete actions:**
>
> 1. End-to-end smoke against a real adviser session — validates Round 4 against transcripts more substantive than the 30-second Anthony Soprano smoke. Either Andrew records a realistic synthetic conversation or uses Concilio in a live adviser meeting.
> 2. **xplan import** — largest remaining parallel-track item. ~3 coding sessions estimated. Andrew to obtain real xplan export and diff against the v1 draft mapping. Worth starting next session.
> 3. **Round 5 (client search)** — small, slot anywhere.
> 4. **Andrew actions:** TD #93 fix, 2FA verification, custom domain decision, xplan license sequencing with Iress.
> 5. **Cut-over readiness workstream:** Container Apps migration, pen test scheduling, compliance posture document, backup-restore drill. Some items pre-cut-over, some fast-follow within 2-3 weeks. See master build list §23.
>
> **Real-usage feedback drives polish post-cut-over.** Dashboard rewiring, visual sweeps, prompt v1.1 tuning all wait on data from real team use, not pre-emptive guessing.
>
> **Don't relitigate** any of decisions 1–167. Round 4 design questions Q1–Q12 are all locked.
>
> **Andrew's role:** review, decide, redirect. All execution is via Codex. Operational patterns: single-instruction commit prompts, ASCII-only commit messages, code-block pastes (principles 53–55). Vercel env vars + `.env.local` together with redeploy after for new integrations (decision 157).
>
> Handover framework loaded; produce addendum 17 at session end and update the state snapshot + master build list."

---

## 8. Session log

| Date | Addendum | Summary | Key commits |
|---|---|---|---|
| 28 Apr 2026 | addendum 10 | Round 1 shipped + Round 2 scoped | many |
| 29 Apr 2026 | addendum 11 | Round 2 fully shipped | `928b2c0`, `2a56c75`, `ac0f5a0`, `0d91d59` |
| 1 May 2026 | addendum 12 | Round 3 Half A shipped + Half B Prompts 1–4.5 | many |
| 1 May 2026 (late) | addendum 13 | Round 3 Half B Prompt 5 shipped; Half C spec drafted; principle 52 | `3f5f199` |
| 2 May 2026 | addendum 14 | Round 3 Half C all 7 prompts shipped; Round 3 COMPLETE; Round 4 spec drafted | `9b2ece1`, `95599b4`, `b42f244`, `0e42414`, `ae81c79`, `f9c3f98`, `f37f1d7` |
| 3 May 2026 (am) | addendum 15 | Round 4 Q1–Q12 locked; Prompts 1–4 + 2.1 + 4.1 shipped; transcription pipeline live; Vercel Pro upgrade; principles 53–55 | `5e1d9ca`, `440d95b`, `4cbe3c1`, `b8bad37`, `ec1346a`, `42e5d79`, `cd137b5` |
| 3 May 2026 (pm) | addendum 16 | Round 4 COMPLETE: 4.2, 5a, 5b, 6, 7, 8, 10, 11 shipped. AU East cutover green. Cut-over readiness workstream defined. Decisions 156–167 | `2e9ce2c`, `ba44a3d`, `9075c60`, `97220ac`, `4ef4178`, `af488cd`, `6260933`, `855a001` |

---

## Document version

- **Version:** 8
- **Last updated:** 3 May 2026 (addendum 16)
