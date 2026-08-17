-- AlterTable
ALTER TABLE "AgentExecution" ADD COLUMN     "agentDefinitionKey" TEXT,
ADD COLUMN     "agentDefinitionVersion" INTEGER,
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "errorCode" TEXT;

-- CreateTable
CREATE TABLE "AgentCognitiveStep" (
    "id" TEXT NOT NULL,
    "agentExecutionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "schemaKey" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "resultHash" TEXT NOT NULL,
    "promptSnapshotId" TEXT,
    "llmInvocationId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCognitiveStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCognitiveStep_agentExecutionId_idx" ON "AgentCognitiveStep"("agentExecutionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCognitiveStep_agentExecutionId_phase_attempt_key" ON "AgentCognitiveStep"("agentExecutionId", "phase", "attempt");
