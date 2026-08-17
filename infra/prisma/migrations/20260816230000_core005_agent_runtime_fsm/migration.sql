-- AlterTable
ALTER TABLE "AgentExecution" ADD COLUMN     "agentInstanceId" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "heartbeatAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "agentExecutionId" TEXT,
ADD COLUMN     "executionMode" TEXT,
ADD COLUMN     "fallbackReason" TEXT;

-- CreateTable
CREATE TABLE "AgentInstance" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "agentDefinitionKey" TEXT NOT NULL,
    "agentDefinitionVersion" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "currentJobId" TEXT,
    "lastJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeTimelineEvent" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "agentInstanceId" TEXT NOT NULL,
    "agentExecutionId" TEXT,
    "jobId" TEXT,
    "type" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRuntimeTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentInstance_missionId_idx" ON "AgentInstance"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_missionId_agentDefinitionKey_key" ON "AgentInstance"("missionId", "agentDefinitionKey");

-- CreateIndex
CREATE INDEX "AgentRuntimeTimelineEvent_agentInstanceId_createdAt_idx" ON "AgentRuntimeTimelineEvent"("agentInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRuntimeTimelineEvent_agentExecutionId_idx" ON "AgentRuntimeTimelineEvent"("agentExecutionId");

-- CreateIndex
CREATE INDEX "AgentExecution_agentInstanceId_idx" ON "AgentExecution"("agentInstanceId");
