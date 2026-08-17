CREATE TABLE "ArchitectureComposition" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "approvedSolutionId" TEXT NOT NULL, "approvedSolutionVersion" INTEGER NOT NULL,
  "solutionHash" TEXT NOT NULL, "requirementBaselineId" TEXT NOT NULL,
  "requirementBaselineHash" TEXT NOT NULL, "scopeCoverageHash" TEXT NOT NULL,
  "proposalAgentExecutionId" TEXT NOT NULL, "proposalAgentDefinitionKey" TEXT NOT NULL,
  "proposalAgentDefinitionVersion" INTEGER NOT NULL, "proposalPromptSnapshotId" TEXT NOT NULL,
  "architectureStyle" TEXT NOT NULL, "modulesJson" JSONB NOT NULL DEFAULT '[]',
  "decisionsJson" JSONB NOT NULL DEFAULT '[]', "integrationsJson" JSONB NOT NULL DEFAULT '[]',
  "dataFlowsJson" JSONB NOT NULL DEFAULT '[]', "securityBoundariesJson" JSONB NOT NULL DEFAULT '[]',
  "requirementMappingsJson" JSONB NOT NULL DEFAULT '[]', "exactStackSelectionsJson" JSONB NOT NULL DEFAULT '[]',
  "proposalResultHash" TEXT NOT NULL, "architectureHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3), CONSTRAINT "ArchitectureComposition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArchitectureComposition_approvedSolutionId_key" ON "ArchitectureComposition"("approvedSolutionId");
CREATE UNIQUE INDEX "ArchitectureComposition_missionId_version_key" ON "ArchitectureComposition"("missionId", "version");
CREATE INDEX "ArchitectureComposition_missionId_status_idx" ON "ArchitectureComposition"("missionId", "status");
CREATE INDEX "ArchitectureComposition_approvedSolutionId_solutionHash_idx" ON "ArchitectureComposition"("approvedSolutionId", "solutionHash");

DROP INDEX IF EXISTS "ArchitectureReview_missionId_key";
ALTER TABLE "ArchitectureReview" ADD COLUMN "reviewMode" TEXT NOT NULL DEFAULT 'LEGACY_COMPATIBILITY';
CREATE UNIQUE INDEX "ArchitectureReview_architectureCompositionId_key" ON "ArchitectureReview"("architectureCompositionId");
CREATE INDEX "ArchitectureReview_missionId_reviewMode_idx" ON "ArchitectureReview"("missionId", "reviewMode");

ALTER TABLE "ArchitectureReviewerExecution"
ADD COLUMN "agentExecutionId" TEXT,
ADD COLUMN "agentDefinitionKey" TEXT,
ADD COLUMN "agentDefinitionVersion" INTEGER,
ADD COLUMN "promptSnapshotId" TEXT,
ADD COLUMN "resultHash" TEXT,
ADD COLUMN "resultJson" JSONB;

ALTER TABLE "ArchitectureReviewFinding"
ADD COLUMN "reviewerAgentExecutionId" TEXT,
ADD COLUMN "reviewerAgentDefinitionKey" TEXT,
ADD COLUMN "reviewerAgentDefinitionVersion" INTEGER,
ADD COLUMN "category" TEXT,
ADD COLUMN "moduleKeysJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "decisionKeysJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "requirementKeysJson" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "proposedResolution" TEXT;

CREATE TABLE "ArchitectureArbitration" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "architectureCompositionId" TEXT NOT NULL,
  "agentExecutionId" TEXT NOT NULL, "agentDefinitionKey" TEXT NOT NULL,
  "agentDefinitionVersion" INTEGER NOT NULL, "promptSnapshotId" TEXT NOT NULL,
  "resultHash" TEXT NOT NULL, "resultJson" JSONB NOT NULL, "verdict" TEXT NOT NULL,
  "unresolvedFindingIdsJson" JSONB NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchitectureArbitration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArchitectureArbitration_architectureCompositionId_key" ON "ArchitectureArbitration"("architectureCompositionId");
CREATE INDEX "ArchitectureArbitration_missionId_idx" ON "ArchitectureArbitration"("missionId");
