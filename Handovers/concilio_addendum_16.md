# Concilio v14 addendum 16

**Date:** 3 May 2026
**Parent docs:** v14 + addendums 1–15
**Author:** Claude
**Summary:** Round 4 COMPLETE. Prompts 4.2, 5a, 5b, 6, 7, 8, 10, 11 all shipped. End-to-end pipeline live in production from in-app recording through to published file note with extracted tasks, parked facts, and notifications — all running on Australia East AI infrastructure. Data residency loop closed. Cut-over readiness conversation mid-session redrew the run-up to Wednesday cut-over.

---

## 1. Session goal & outcome

Set out to ship Prompt 5 (AI file-note generation + adviser review UI) and continue through Round 4 prompts as time allowed.

Outcome: substantially over-delivered. Eight prompts shipped: 4.2 (Calendly intake → meeting_attendee), 5a (AI generation pipeline backend), 5b (adviser review UI), 6 (task extraction), 7 (fact extraction with three-state confirm UX), 8 (notification system), 10 (polish — brand typography + heading legibility + generation-failure alert), 11 (Australia East AI region cutover). Prompt 9 (Teams Graph webhook) deferred per cut-over scope decision; manual recording upload covers the gap. Round 4 prompts complete except for the deferred 9.

The session also surfaced three architectural conversations that reshaped near-term work:

- A cut-over readiness security and infrastructure discussion (latency, data residency, Container Apps migration urgency, pen test, compliance posture).
- A reframing of fact extraction posture (AI extracts, adviser filters; bias toward more capture over time; ancestry.com hint pattern as the design reference).
- A polish discipline call: defer dashboard rewiring and visual sweeps until real team feedback after cut-over.

End-of-session pipeline runs end-to-end against Australia East: recording → SharePoint upload → batch transcription with diarisation → AI draft + tasks + facts (sibling jobs) → adviser review UI → publish writes file_note + Task rows + parked_fact rows + audit_event in one transaction → notification fires (bell + email + dashboard alert) and clears on publish. Eight commits this session, no rollbacks. One Azure Speech endpoint correction needed mid-Prompt-11 (real-time STT endpoint vs. batch Cognitive Services endpoint — portal labelling caught us once).

## 2. Code state changes

Eight commits this session on `main`, all auto-deployed green to Vercel:

- `2e9ce2c` — `feat(round4): calendly intake populates meeting_attendee + meeting_modality` (Prompt 4.2)
- `ba44a3d` — `feat(round4): ai file-note generation pipeline` (Prompt 5a)
- `9075c60` — `feat(round4): adviser review ui for ai-generated file notes` (Prompt 5b)
- `97220ac` — `feat(round4): ai task extraction + tick-box review on file-note review screen` (Prompt 6)
- `4ef4178` — `feat(round4): ai fact extraction with three-state confirm ui` (Prompt 7)
- `af488cd` — `feat(round4): notification system for file note review ready` (Prompt 8)
- `6260933` — `chore(polish): brand typography + client record heading legibility + tdebt cleanup` (Prompt 10)
- `855a001` — `feat(round4): region cutover - azure ai services moved to australia east` (Prompt 11)

GitHub `main` HEAD at session end: `855a001`. Vercel running latest. No local-only or unpushed work. Working tree clean.

**Notable new modules created (~20 files):**

- `src/lib/file-note-prompt.ts` — v1 humanised narrative prompt
- `src/lib/task-extraction-prompt.ts` — v1 conservative task prompt
- `src/lib/fact-extraction-prompt.ts` — v1 schema-aware fact prompt
- `src/lib/extractable-facts.ts` — covered fields (person/employment_profile/centrelink_detail) + park-only categories
- `src/lib/azureOpenAI.ts` — gpt-4o client wrapper with region selection
- `src/lib/jobs/generateFileNote.ts`, `extractTasks.ts`, `extractFacts.ts` — sibling job handlers
- `src/lib/notifications/fileNoteReviewReady.ts` — consolidated notification trigger
- `src/lib/jobs/maybeNotifyReviewReady.ts` — sibling-job completion gate
- New review screen at `/clients/[id]/file-notes/[fileNoteId]/review`
- New parked-facts read-only route at `/clients/[id]/parked-facts`
- Bell component in `src/components/layout/Topbar.tsx` with unread count
- `docs/region-cutover.md` — rollback procedure documentation

## 3. Database state changes

Migrations applied to Azure (and local) covering:

- `meeting_attendee` populated by Calendly intake (table existed from Prompt 2; intake plumbing added in 4.2).
- `engagement.meeting_modality` parsed from Calendly location field (column existed from Prompt 2; parsing added in 4.2).
- `file_note` extensions for AI pipeline: `published_at`, `published_by`, `extracted_tasks` JSONB, `task_extraction_*` metadata, `task_publish_decisions` JSONB, `extracted_facts` JSONB, `fact_extraction_*` metadata, `fact_publish_decisions` JSONB.
- `task` extensions: `actor_side` enum (us/client) and `monday_sync_state` text.
- `alert_instance` extensions: `recipient_user_id` UUID FK to user_account, `cleared_at` timestamptz, partial unique index on (subject_type, subject_id, alert_type) where cleared_at IS NULL.
- New alert types: `file_note_review_outstanding`, `file_note_generation_failed`.

End-of-session row counts: ~12 file_note rows (5 pre-existing manual + new transcript-derived from session smokes); 1 parked_fact row from Prompt 7 smoke (NAB term deposit); 1 parked_fact from Prompt 11 smoke (super balance ~$250k); several Task rows from publish smokes; multiple alert_instance rows in cleared state. Schema alignment between Azure and GitHub `main` in sync.

## 4. Decisions locked this session

Decisions 156–167 added. Recorded in `concilio_state_snapshot.md` v8.

- **156** — Decision 155 (QuickAddNoteModal extension to write file_note) deferred from 5b. The editable draft pane on the review screen subsumes the discard-AI fallback use case. Manual-only file_note creation without any recording becomes a separate post-cut-over polish prompt if real-usage signal calls for it.
- **157** — Vercel env vars and `.env.local` are both required when adding new external service integrations. Both must be populated before any prompt that touches the new service runs in production. Redeploy required after adding Vercel vars (vars don't bind to running runtime until redeploy).
- **158** — Task type/subtype are dynamic `TaskTypeOption` rows, not Prisma enums. The AI extraction prompt receives them as a runtime-resolved option list.
- **159** — `task.actor_side` and `task.monday_sync_state` columns populated by Round 4 publish flow only. Other Task creation paths (manual via `/api/tasks`) currently leave both null. Correct interim — the columns are Round 4 semantics.
- **160** — Row-based schema tables (`financial_account`, `goal`, `liability`, `insurance_policy`, `super_pension_account`, `property_asset`, `professional_contacts`, `estate_people`, `household_members`) are PARK-ONLY in Round 4 v1 fact extraction. Future rounds (Goals/Insurance/Investments/etc.) include "adopt parked facts" with proper row-matching/creation UI as part of those rounds' build work.
- **161** — Sensitive identity/compliance fields are excluded from AI extraction entirely (not park, not update — not extracted). Excluded list: `person.mothers_maiden_name`, `person.is_pep_risk`, `person.pep_notes`, `centrelink_detail.crn`, address JSON. Adviser-set via existing forms; AI does not touch.
- **162** — Employment is the one row-based table treated as covered in v1, via "update latest active employment_profile row or insert" upsert rule. The simplicity of one-current-employment-per-person makes the upsert safe; other row-based tables don't have this property.
- **163** — Fact extraction posture: AI extracts, adviser filters. The intent is to capture more structured information than the firm previously did, accepting AI interpretation will sometimes need correction. Park is the "real fact, no clean home yet" valve; Drop is the "AI got it wrong" valve. Posture biases toward more extraction with adviser as filter, not less extraction with AI as filter. Prompt tuning post-cut-over driven by real-usage signal.
- **164** — Source preservation through fact lifecycle. Every AI-extracted fact carries an unbroken chain back to the source recording: structured field / parked_fact / dropped audit entry → file_note → meeting_transcript → recording_url. Future-round parked-fact adoption preserves the chain into the new structured row. Provenance never lost. Models the ancestry.com hint pattern (source artifact always reachable).
- **165** — `maybeNotifyReviewReady` called from the queue worker AFTER job status write, not from inside the handler before return. Ensures the helper sees the just-finished job as terminal when querying processing_job state.
- **166** — Tailwind v4 with `@theme` block in `src/app/globals.css` is the project's design-token surface, NOT `tailwind.config.ts`. Future polish prompts target globals.css for token additions.
- **167** — Azure Speech batch transcription endpoint is the regional Cognitive Services endpoint (`https://<region>.api.cognitive.microsoft.com/`), NOT the regional STT SDK endpoint (`https://<region>.stt.speech.microsoft.com`). Concilio uses the batch transcription REST API which is hosted on the Cognitive Services endpoint. The portal's "Speech to text endpoint" label refers to the SDK endpoint and is a red herring for our use case. Caught us once mid-Prompt-11; documented to avoid recurrence.

## 5. Open questions / blocked on

Nothing blocking. Build can resume at xplan import or Round 5 next session.

Three parallel-track items in flight or pending:

- **xplan import** — `concilio_xplan_import_mapping.md` v1 draft from prior session still standing. ~3 coding sessions estimated. Andrew to obtain real xplan export and diff against draft.
- **Folder taxonomy reconciliation** — locked list still standing; per-client SharePoint folder resolver remains a stub (TD #105) until cowork-agents output ships.
- **2FA verification + user accounts setup** — Andrew action via Azure AD; pre-cut-over.

## 6. Tech debt and tidy-ups

**Added this session:**

- **113** — Anthony Soprano test recording predates Prompt 4.2 Calendly intake; has no engagement and no meeting_attendee rows. Speaker prefill falls back to "Speaker 1." Acceptable; old test data not mission-critical (mirrors TD #110 pattern).
- **114** — No shared Task creation helper; logic duplicated between `src/app/api/tasks/route.ts` (manual creation) and the publish handler. Refactor candidate post-cut-over; not blocking.
- **115** — Fact extraction prompt v1.1 tuning. After 2 weeks of real-usage data, review extracted_facts vs fact_publish_decisions audit data. If Drop rate is low and Park rate reasonable, tune toward more aggressive extraction. If Drop rate is high, prompt is over-extracting. Drives v1.1.
- **117** — Codex's smoke artifacts (`tmp-prompt*-*` files) should be swept at the end of each prompt's smoke, not left in the working dir. Caught us at start of Prompt 11 (untracked files tripped the workspace gate). Small operational discipline; not blocking.

**Resolved this session:**

- **116** — `file_note_generation_failed` notification path. Was created and resolved within the session; Prompt 10 wired the alert.
- TD #93 (localhost auth `invalid_client`) remains active. Carried via principle 52 (production smoke). Surfacing more visibly each session — recorder mic permission and local Graph email both blocked through this session. ~15 min job once Andrew has Azure Portal time. Worth doing before Wednesday cut-over so smokes land cleanly.

## 7. Working pattern notes

No new principles added this session. Three operational refinements observed:

- **Two paste-truncation incidents this session.** Prompt 4.2's commit message code block didn't make it through to Codex (Codex inferred a reasonable substitute). Worth being more careful about long pastes; quick visual eyeball before sending is cheap insurance. Pattern noted in addendum 15; recurred here.
- **Vercel env var configuration must be explicit.** Caught us twice in this session: once at Prompt 5a (Andrew added to `.env.local` only, missed Vercel; surfaced when Prompt 5b's regenerate cron failed in production), once at Prompt 11 mid-smoke (AU Speech endpoint pointed at the SDK endpoint, not the batch endpoint; surfaced after Vercel redeploy). Both fixed cleanly. Codified into decision 157.
- **Cut-over readiness conversation reshaped scope.** Mid-session, Andrew flagged that current latency and security posture would matter at cut-over. The conversation converted vague "post-cut-over hardening" assumptions into a defined cut-over readiness workstream (security + infrastructure + custom domain + pen test + compliance posture) — see master build list updates.

## 8. Next session pickup

**Concrete first action:** confirm Round 4 is genuinely complete by running an end-to-end smoke from a real adviser session (a real recording with multiple speakers, real client, real meeting context). Either Andrew records a synthetic but realistic test conversation or waits for the next live adviser meeting and uses Concilio for the file-note flow. This validates the pipeline against transcripts more substantive than the 30-second Anthony Soprano smoke.

**Then:** xplan import is the largest remaining parallel-track item. ~3 coding sessions estimated. Worth starting next session — the import script + smoke against a real xplan export is the longest pole in the cut-over tent.

**Round 5 (client search)** is small and parallel-trackable. Slot anywhere.

**Andrew actions outstanding:**

- TD #93 — localhost auth fix (~15 min; reduces friction on every subsequent smoke).
- 2FA verification across all adviser accounts (Azure AD).
- Custom domain decision — `concilio.arwm.com.au` or similar pointing at the Vercel deployment. Five-minute setup once decided.
- xplan license reduction — Andrew flagged keeping one seat alive for investment + portal until those are replaced. Worth confirming notice period and data export sequencing with Iress.

**Cut-over readiness workstream items (from mid-session conversation):**

- Container Apps migration (TD #30 promoted from "post-cut-over hardening" to "fast-follow within 2-3 weeks of cut-over"). Latency improvement + all-in-Azure tenant.
- External pen test scheduled post-functional-completion, pre-going-wide-on-real-data.
- Compliance posture document (where data lives, access controls, backup posture, incident response, data classification).
- Documented backup-restore drill against Azure Postgres.

These are documented in master build list section 23 (cut-over preparation).

**Pickup script:** see updated state snapshot v8.

**Cut-over context.** Round 4 floor is laid. Functional MVP is genuinely close to where Andrew wants it (his read: "90% probably higher of what the team needs"). Wednesday cut-over target depends on xplan import + Round 5 + parallel-track Andrew actions landing in the next ~22 hours of session time. Achievable; not generous.

The Round 4 ship is the workflow shift from "Concilio holds client data" to "Concilio is where advice work happens." Adviser doesn't fill forms; conversations become structured data. Information that previously vanished into narrative file notes now accumulates as searchable structured facts (or parked for future rounds to adopt). The institutional memory shape is meaningfully different.
