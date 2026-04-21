ALTER TABLE "engagement"
ADD COLUMN "reminder_sms_sent_at" TIMESTAMPTZ(6),
ADD COLUMN "reminder_sms_message_id" TEXT;
