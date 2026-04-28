-- Round 1 Half A audit trail expansion.
-- event_type is currently TEXT, so the action vocabulary is extended in place.

ALTER TABLE "public"."audit_event"
  ADD COLUMN IF NOT EXISTS "actor_ip" TEXT,
  ADD COLUMN IF NOT EXISTS "actor_user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "before_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "after_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "request_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_audit_subject_occurred_desc"
  ON "public"."audit_event" ("subject_type", "subject_id", "occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_actor_occurred_desc"
  ON "public"."audit_event" ("actor_id", "occurred_at" DESC);

-- Corps Act / RG 175 / RG 244 require an immutable audit trail; audit_event is append-only.
CREATE OR REPLACE FUNCTION "public"."prevent_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only: UPDATE and DELETE are prohibited for compliance with Corps Act / RG 175 / RG 244 immutable audit trail requirements';
END;
$$;

COMMENT ON FUNCTION "public"."prevent_audit_event_mutation"()
  IS 'Compliance rationale: Corps Act / RG 175 / RG 244 require immutable audit trail records, so audit_event rows cannot be updated or deleted.';

DROP TRIGGER IF EXISTS "audit_event_append_only_update" ON "public"."audit_event";
CREATE TRIGGER "audit_event_append_only_update"
BEFORE UPDATE ON "public"."audit_event"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_audit_event_mutation"();

DROP TRIGGER IF EXISTS "audit_event_append_only_delete" ON "public"."audit_event";
CREATE TRIGGER "audit_event_append_only_delete"
BEFORE DELETE ON "public"."audit_event"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_audit_event_mutation"();

DO $$
DECLARE
  closing_template_id UUID;
  workflow_task_template_count INTEGER := 0;
  workflow_instance_count INTEGER := 0;
  workflow_spawned_task_count INTEGER := 0;
  nudge_template_count INTEGER := 0;
  workflow_template_nudge_count INTEGER := 0;
  total_dependents INTEGER := 0;
BEGIN
  SELECT "id"
  INTO closing_template_id
  FROM "public"."workflow_template"
  WHERE "name" = 'closing' OR "key" = 'closing'
  LIMIT 1;

  IF closing_template_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO workflow_task_template_count
  FROM "public"."workflow_task_template"
  WHERE "workflow_template_id" = closing_template_id;

  SELECT COUNT(*)
  INTO workflow_instance_count
  FROM "public"."workflow_instance"
  WHERE "workflow_template_id" = closing_template_id
     OR "template_id" = closing_template_id;

  SELECT COUNT(*)
  INTO workflow_spawned_task_count
  FROM "public"."workflow_spawned_task" spawned_task
  INNER JOIN "public"."workflow_task_template" task_template
    ON task_template."id" = spawned_task."workflow_task_template_id"
  WHERE task_template."workflow_template_id" = closing_template_id;

  SELECT COUNT(*)
  INTO nudge_template_count
  FROM "public"."nudge_template"
  WHERE "trigger_workflow_template_key" = 'closing'
     OR "trigger_task_template_id" IN (
       SELECT "id"
       FROM "public"."workflow_task_template"
       WHERE "workflow_template_id" = closing_template_id
     );

  SELECT COUNT(*)
  INTO workflow_template_nudge_count
  FROM "public"."workflow_template_nudge"
  WHERE "workflow_template_key" = 'closing';

  total_dependents := workflow_task_template_count
    + workflow_instance_count
    + workflow_spawned_task_count
    + nudge_template_count
    + workflow_template_nudge_count;

  IF total_dependents > 0 THEN
    RAISE EXCEPTION 'Cannot delete workflow_template closing: % dependent row(s) exist (workflow_task_template %, workflow_instance %, workflow_spawned_task %, nudge_template %, workflow_template_nudge %). Delete halted; no cascade was performed.',
      total_dependents,
      workflow_task_template_count,
      workflow_instance_count,
      workflow_spawned_task_count,
      nudge_template_count,
      workflow_template_nudge_count;
  END IF;

  DELETE FROM "public"."workflow_template"
  WHERE "id" = closing_template_id
    AND ("name" = 'closing' OR "key" = 'closing');
END $$;
