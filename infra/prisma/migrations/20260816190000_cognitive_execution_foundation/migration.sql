-- AlterTable
ALTER TABLE "GeneratedArtifact" ADD COLUMN     "provenanceKind" TEXT NOT NULL DEFAULT 'DETERMINISTIC_TEMPLATE';

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationRunId" TEXT,
    "generationJobId" TEXT,
    "agentKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "elapsedMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmInvocationRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "agentExecutionId" TEXT,
    "architectureReviewerExecutionId" TEXT,
    "purpose" TEXT NOT NULL,
    "phase" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptSnapshotId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmInvocationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptSnapshot" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "jobId" TEXT,
    "agentExecutionId" TEXT,
    "promptType" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "inputVersionRefsJson" JSONB NOT NULL DEFAULT '{}',
    "outputSchemaKey" TEXT,
    "renderedPromptHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentExecution_missionId_generationRunId_idx" ON "AgentExecution"("missionId", "generationRunId");

-- CreateIndex
CREATE INDEX "AgentExecution_generationJobId_idx" ON "AgentExecution"("generationJobId");

-- CreateIndex
CREATE INDEX "LlmInvocationRecord_missionId_idx" ON "LlmInvocationRecord"("missionId");

-- CreateIndex
CREATE INDEX "LlmInvocationRecord_agentExecutionId_idx" ON "LlmInvocationRecord"("agentExecutionId");

-- CreateIndex
CREATE INDEX "LlmInvocationRecord_architectureReviewerExecutionId_idx" ON "LlmInvocationRecord"("architectureReviewerExecutionId");

-- CreateIndex
CREATE INDEX "PromptSnapshot_missionId_idx" ON "PromptSnapshot"("missionId");

