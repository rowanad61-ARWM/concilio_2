-- CreateEnum
CREATE TYPE "RecurrenceCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "TaskOwner" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "TaskOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDocumentLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sharepointDriveItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDocumentLink_pkey" PRIMARY KEY ("id")
);

-- Backfill TaskOwner from Task.ownerUserId
INSERT INTO "TaskOwner" ("id", "taskId", "userId")
SELECT gen_random_uuid()::text, "id", "ownerUserId"
FROM "Task"
WHERE "ownerUserId" IS NOT NULL;

-- DropIndex
DROP INDEX "Task_ownerUserId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "ownerUserId",
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "recurrenceCadence" "RecurrenceCadence",
ADD COLUMN     "recurrenceCount" INTEGER,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TaskOwner_userId_idx" ON "TaskOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOwner_taskId_userId_key" ON "TaskOwner"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskDocumentLink_taskId_idx" ON "TaskDocumentLink"("taskId");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOwner" ADD CONSTRAINT "TaskOwner_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDocumentLink" ADD CONSTRAINT "TaskDocumentLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
