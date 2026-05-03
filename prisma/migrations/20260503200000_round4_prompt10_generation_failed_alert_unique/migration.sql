CREATE UNIQUE INDEX "idx_alert_instance_file_note_generation_failed_open_unique"
  ON "alert_instance"("entity_type", "entity_id", "alert_type")
  WHERE "alert_type" = 'file_note_generation_failed'
    AND "cleared_at" IS NULL;
