ALTER TABLE "public"."person"
  ADD COLUMN "emergency_contact_name" TEXT,
  ADD COLUMN "emergency_contact_relationship" TEXT,
  ADD COLUMN "emergency_contact_phone" TEXT,
  ADD COLUMN "emergency_contact_email" TEXT,
  ADD COLUMN "emergency_contact_notes" TEXT;

CREATE TABLE "public"."timeline_entry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "party_id" UUID NOT NULL,
  "household_id" UUID,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'native',
  "external_ref" TEXT,
  "external_designation" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "actor_user_id" UUID,
  "related_entity_type" TEXT,
  "related_entity_id" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "inserted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "metadata" JSONB,
  CONSTRAINT "timeline_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_entry_kind_check"
    CHECK (
      "kind" IN (
        'email_in',
        'email_out',
        'sms_in',
        'sms_out',
        'phone_call',
        'meeting',
        'file_note',
        'document',
        'portal_message',
        'workflow_event',
        'alert',
        'task',
        'system'
      )
    ),
  CONSTRAINT "timeline_entry_source_check"
    CHECK (
      "source" IN (
        'native',
        'xplan',
        'manual_import'
      )
    ),
  CONSTRAINT "timeline_entry_party_id_fkey"
    FOREIGN KEY ("party_id")
    REFERENCES "public"."party"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT "timeline_entry_household_id_fkey"
    FOREIGN KEY ("household_id")
    REFERENCES "public"."household_group"("id")
    ON DELETE SET NULL
    ON UPDATE NO ACTION,
  CONSTRAINT "timeline_entry_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id")
    REFERENCES "public"."user_account"("id")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_timeline_entry_party_occurred_desc"
  ON "public"."timeline_entry"("party_id", "occurred_at" DESC);

CREATE INDEX "idx_timeline_entry_kind"
  ON "public"."timeline_entry"("kind");

CREATE INDEX "idx_timeline_entry_source_external_ref"
  ON "public"."timeline_entry"("source", "external_ref");

CREATE INDEX "idx_timeline_entry_related_entity"
  ON "public"."timeline_entry"("related_entity_type", "related_entity_id");

CREATE TABLE "public"."timeline_attachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "timeline_entry_id" UUID NOT NULL,
  "document_id" UUID,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "inserted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "timeline_attachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_attachment_timeline_entry_id_fkey"
    FOREIGN KEY ("timeline_entry_id")
    REFERENCES "public"."timeline_entry"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT "timeline_attachment_document_id_fkey"
    FOREIGN KEY ("document_id")
    REFERENCES "public"."document"("id")
    ON DELETE SET NULL
    ON UPDATE NO ACTION
);

CREATE INDEX "idx_timeline_attachment_entry_id"
  ON "public"."timeline_attachment"("timeline_entry_id");
