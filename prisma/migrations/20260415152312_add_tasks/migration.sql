-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING_EXTERNAL', 'WAITING_INTERNAL', 'NEEDS_REVIEW', 'WITH_CLIENT', 'STUCK', 'ON_HOLD', 'DONE');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "ownerUserId" UUID,
    "dueDateStart" TIMESTAMP(3),
    "dueDateEnd" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTypeOption" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");

-- CreateIndex
CREATE INDEX "Task_ownerUserId_idx" ON "Task"("ownerUserId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "TaskTypeOption_type_idx" ON "TaskTypeOption"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTypeOption_type_subtype_key" ON "TaskTypeOption"("type", "subtype");
