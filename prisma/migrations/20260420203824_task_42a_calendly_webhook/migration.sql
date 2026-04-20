-- CreateEnum
CREATE TYPE "EngagementSource" AS ENUM ('MANUAL', 'CALENDLY', 'XPLAN_IMPORT');

-- AlterTable
ALTER TABLE "engagement" ADD COLUMN     "calendly_cancel_url" TEXT,
ADD COLUMN     "calendly_event_type_uri" TEXT,
ADD COLUMN     "calendly_event_uuid" TEXT,
ADD COLUMN     "calendly_invitee_uuid" TEXT,
ADD COLUMN     "calendly_reschedule_url" TEXT,
ADD COLUMN     "calendly_rescheduled_from" TEXT,
ADD COLUMN     "meeting_type_key" TEXT,
ADD COLUMN     "source" "EngagementSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "calendly_event_type_map" (
    "id" TEXT NOT NULL,
    "meeting_type_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "calendly_event_type_uri" TEXT,
    "auto_create_prospect" BOOLEAN NOT NULL,
    "unresolved_log_level" TEXT NOT NULL DEFAULT 'warn',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendly_event_type_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendly_event_type_map_meeting_type_key_key" ON "calendly_event_type_map"("meeting_type_key");

-- CreateIndex
CREATE UNIQUE INDEX "calendly_event_type_map_calendly_event_type_uri_key" ON "calendly_event_type_map"("calendly_event_type_uri");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_calendly_event_uuid_key" ON "engagement"("calendly_event_uuid");
