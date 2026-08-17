-- CORE-010: independent candidate review and external rework lineage.
ALTER TABLE "AgentExecution" ADD COLUMN "reviewRecordId" TEXT;
ALTER TABLE "AgentExecution" ADD COLUMN "sourceWorkspaceSessionId" TEXT;

CREATE TABLE "ReviewRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "missionId" TEXT NOT NULL,
  "generationJobId" TEXT NOT NULL,
  "workspaceSessionId" TEXT NOT NULL,
  "executorAgentExecutionId" TEXT,
  "executorAgentDefinitionKey" TEXT NOT NULL,
  "executorAgentDefinitionVersion" INTEGER,
  "reviewerAgentExecutionId" TEXT NOT NULL,
  "reviewerAgentDefinitionKey" TEXT NOT NULL,
  "reviewerAgentDefinitionVersion" INTEGER NOT NULL,
  "reviewerAgentInstanceId" TEXT,
  "candidateFingerprint" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "changeSetHash" TEXT NOT NULL,
  "resultHash" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "reviewCycle" INTEGER NOT NULL DEFAULT 1,
  "confidence" REAL NOT NULL,
  "summary" TEXT NOT NULL,
  "requirementAssessmentJson" JSONB NOT NULL DEFAULT '[]',
  "promptSnapshotId" TEXT,
  "llmInvocationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CodeReviewFinding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reviewRecordId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "path" TEXT,
  "message" TEXT NOT NULL,
  "requirementIdsJson" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ReviewRecord_generationJobId_idx" ON "ReviewRecord"("generationJobId");
CREATE INDEX "ReviewRecord_missionId_idx" ON "ReviewRecord"("missionId");
CREATE INDEX "ReviewRecord_workspaceSessionId_idx" ON "ReviewRecord"("workspaceSessionId");
CREATE UNIQUE INDEX "ReviewRecord_workspaceSessionId_candidateFingerprint_reviewCycle_key"
  ON "ReviewRecord"("workspaceSessionId", "candidateFingerprint", "reviewCycle");
CREATE INDEX "CodeReviewFinding_reviewRecordId_idx" ON "CodeReviewFinding"("reviewRecordId");
CREATE INDEX "CodeReviewFinding_missionId_idx" ON "CodeReviewFinding"("missionId");
