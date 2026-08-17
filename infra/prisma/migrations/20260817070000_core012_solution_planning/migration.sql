-- CORE-012: persistent, versioned and immutable canonical ApprovedSolution.
CREATE TABLE "ApprovedSolution" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "requirementBaselineId" TEXT NOT NULL,
  "requirementBaselineVersion" INTEGER NOT NULL,
  "requirementBaselineHash" TEXT NOT NULL,
  "scopeCoverageHash" TEXT NOT NULL,
  "planningAgentExecutionId" TEXT NOT NULL,
  "plannerAgentDefinitionKey" TEXT NOT NULL,
  "plannerAgentDefinitionVersion" INTEGER NOT NULL,
  "promptSnapshotId" TEXT NOT NULL,
  "solutionPlanResultHash" TEXT NOT NULL,
  "solutionHash" TEXT NOT NULL,
  "solutionType" TEXT NOT NULL,
  "componentsJson" JSONB NOT NULL DEFAULT '[]',
  "stackSelectionsJson" JSONB NOT NULL DEFAULT '[]',
  "requirementDecisionsJson" JSONB NOT NULL DEFAULT '[]',
  "deferredRequirementRefsJson" JSONB NOT NULL DEFAULT '[]',
  "notApplicableRequirementRefsJson" JSONB NOT NULL DEFAULT '[]',
  "constraintsJson" JSONB NOT NULL DEFAULT '[]',
  "nonFunctionalStrategiesJson" JSONB NOT NULL DEFAULT '[]',
  "assumptionsJson" JSONB NOT NULL DEFAULT '[]',
  "risksJson" JSONB NOT NULL DEFAULT '[]',
  "validationJson" JSONB NOT NULL DEFAULT '{}',
  "confidence" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "ApprovedSolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovedSolution_missionId_version_key"
ON "ApprovedSolution"("missionId", "version");

CREATE INDEX "ApprovedSolution_missionId_status_idx"
ON "ApprovedSolution"("missionId", "status");

CREATE INDEX "ApprovedSolution_requirementBaselineId_scopeCoverageHash_idx"
ON "ApprovedSolution"("requirementBaselineId", "scopeCoverageHash");

CREATE INDEX "ApprovedSolution_exact_result_idx"
ON "ApprovedSolution"("missionId", "requirementBaselineHash", "scopeCoverageHash", "solutionHash");
