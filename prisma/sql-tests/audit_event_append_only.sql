-- Verifies audit_event is append-only after the Round 1 Half A migration.
BEGIN;

DO $$
DECLARE
  inserted_audit_id UUID;
  append_only_message TEXT := 'audit_event is append-only:%';
BEGIN
  INSERT INTO "public"."audit_event" (
    "event_type",
    "actor_type",
    "actor_id",
    "subject_type",
    "subject_id",
    "details"
  )
  VALUES (
    'CREATE',
    'system',
    NULL,
    'sql_test',
    gen_random_uuid(),
    '{"test":"append-only"}'::jsonb
  )
  RETURNING "id" INTO inserted_audit_id;

  BEGIN
    UPDATE "public"."audit_event"
    SET "details" = '{"test":"updated"}'::jsonb
    WHERE "id" = inserted_audit_id;

    RAISE EXCEPTION 'Expected audit_event UPDATE to fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE append_only_message THEN
        RAISE;
      END IF;
  END;

  BEGIN
    DELETE FROM "public"."audit_event"
    WHERE "id" = inserted_audit_id;

    RAISE EXCEPTION 'Expected audit_event DELETE to fail';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE append_only_message THEN
        RAISE;
      END IF;
  END;
END $$;

ROLLBACK;
