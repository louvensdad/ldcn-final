-- CreateTable
CREATE TABLE "ReviewerExecution" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "promptMasterId" TEXT NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "promptTemplateVersion" TEXT NOT NULL,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewerExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewerExecution_missionId_promptMasterId_idx" ON "ReviewerExecution"("missionId", "promptMasterId");

