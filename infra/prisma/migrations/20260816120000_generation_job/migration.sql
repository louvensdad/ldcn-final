-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "requirementText" TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "targetFile" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisText" TEXT,
    "planText" TEXT,
    "implementationSummary" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationJob_missionId_generationRunId_idx" ON "GenerationJob"("missionId", "generationRunId");

