ALTER TABLE "alert_instance"
  ADD COLUMN "recipient_user_id" UUID,
  ADD COLUMN "cleared_at" TIMESTAMPTZ(6);

ALTER TABLE "alert_instance"
  ADD CONSTRAINT "alert_instance_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id")
  REFERENCES "user_account"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

CREATE INDEX "idx_alert_instance_recipient_cleared"
  ON "alert_instance"("recipient_user_id", "cleared_at");

CREATE UNIQUE INDEX "idx_alert_instance_file_note_review_open_unique"
  ON "alert_instance"("entity_type", "entity_id", "alert_type")
  WHERE "alert_type" = 'file_note_review_outstanding'
    AND "cleared_at" IS NULL;
