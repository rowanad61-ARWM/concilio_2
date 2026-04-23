# Event Engine Schema (Task 43c.1)

`workflow_instance.scheduled_start_date` plus the widened `status` check (`active | paused | completed | cancelled | error | scheduled`) provides the persistence layer for deferred workflow starts. Later rounds can place an instance in `scheduled` and wake it when the scheduled timestamp is reached, without changing existing active-instance behavior.

`workflow_task_template_outcome` is the per-template outcome catalog used by upcoming outcome-driven transitions. Each task template can define ordered outcome keys, terminal-lost flags, and optional `next_phase_key` hints so 43c.3 can validate and apply transitions without hardcoding options in code.

`workflow_spawned_task.outcome_key`, `outcome_set_at`, and `outcome_set_by` store the runtime selection of an outcome for an instantiated task. This preserves who selected the outcome and when, and gives 43c.3/43c.5 an audit-ready record for phase progression and lifecycle updates.

`nudge_template` stores configurable nudge definitions (audience, trigger condition, cadence, max sends, template linkage, escalation action, deployment status). This is the authoring/config table that 43c.4 and later UI/admin work can manage without code changes.

`nudge_event` tracks each emitted nudge against a polymorphic subject (`engagement`, `task`, or `workflow_instance`) with sequence count and optional outcome metadata. This is the runtime ledger for idempotency, escalation decisions, and reporting in 43c.4-43c.6.

`party.communication_preference` (`auto`/`manual`) introduces a party-level routing override used by later rounds when deciding whether the engine can auto-nudge/auto-progress or must defer to explicit adviser action.
