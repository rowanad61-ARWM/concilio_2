CREATE TABLE "public"."alert_instance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6),
    "acknowledged_by_user_id" UUID,
    "audit_event_id" UUID,

    CONSTRAINT "alert_instance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_alert_instance_acknowledged_occurred"
ON "public"."alert_instance"("acknowledged_at", "occurred_at" DESC);

CREATE INDEX "idx_alert_instance_audit_event"
ON "public"."alert_instance"("audit_event_id");

CREATE INDEX "idx_alert_instance_entity"
ON "public"."alert_instance"("entity_type", "entity_id");

ALTER TABLE "public"."alert_instance"
ADD CONSTRAINT "alert_instance_acknowledged_by_user_id_fkey"
FOREIGN KEY ("acknowledged_by_user_id")
REFERENCES "public"."user_account"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE "public"."alert_instance"
ADD CONSTRAINT "alert_instance_audit_event_id_fkey"
FOREIGN KEY ("audit_event_id")
REFERENCES "public"."audit_event"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;
