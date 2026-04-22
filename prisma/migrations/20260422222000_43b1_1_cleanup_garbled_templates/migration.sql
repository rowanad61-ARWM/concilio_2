BEGIN;

-- Guard: final re-check that the targeted instance has zero spawned tasks.
-- If this returns any rows, ABORT the transaction and report.
DO $$
DECLARE
  orphan_task_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_task_count
  FROM workflow_spawned_task
  WHERE workflow_instance_id = 'cdd89ed3-92ce-45c1-806c-37acecca7ece';

  IF orphan_task_count <> 0 THEN
    RAISE EXCEPTION
      'Refusing to delete workflow_instance cdd89ed3-92ce-45c1-806c-37acecca7ece -- it has % spawned tasks, contradicting the earlier report. Investigate before retrying.',
      orphan_task_count;
  END IF;
END $$;

-- Log the orphan instance details into the migration output before removal,
-- so there is a breadcrumb if anyone ever asks what happened to it.
DO $$
DECLARE
  inst RECORD;
BEGIN
  SELECT id, engagement_id, status, trigger_date, created_at
    INTO inst
    FROM workflow_instance
   WHERE id = 'cdd89ed3-92ce-45c1-806c-37acecca7ece';

  RAISE NOTICE 'Deleting orphan workflow_instance: id=%, engagement_id=%, status=%, trigger_date=%, created_at=%',
    inst.id, inst.engagement_id, inst.status, inst.trigger_date, inst.created_at;
END $$;

-- Remove the orphan instance.
DELETE FROM workflow_instance
WHERE id = 'cdd89ed3-92ce-45c1-806c-37acecca7ece';

-- Remove the three garbled templates.
DELETE FROM workflow_template
WHERE key IN (
  'annual_review_bca3c233',
  'new_client_onboarding_fea325ff',
  'statement_of_advice_2408d127'
);

COMMIT;
