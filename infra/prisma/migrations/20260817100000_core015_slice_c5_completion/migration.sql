ALTER TABLE "ArchitectureComposition" ADD COLUMN "humanApprovalRequestId" TEXT;
CREATE UNIQUE INDEX "ArchitectureComposition_humanApprovalRequestId_key" ON "ArchitectureComposition"("humanApprovalRequestId");

CREATE TABLE "MissionControl" (
  "missionId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNING',
  "activeArchitectureId" TEXT, "activeImplementationPlanId" TEXT,
  "activeVirtualCompanyId" TEXT, "activeAssemblyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionControl_pkey" PRIMARY KEY ("missionId")
);

CREATE TABLE "HumanApprovalRequest" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "trigger" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "subjectHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedBy" TEXT NOT NULL,
  "requestNote" TEXT, "decidedBy" TEXT, "decidedAt" TIMESTAMP(3), "rationale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HumanApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HumanApprovalRequest_trigger_subjectType_subjectId_subjectHash_key" ON "HumanApprovalRequest"("trigger", "subjectType", "subjectId", "subjectHash");
CREATE INDEX "HumanApprovalRequest_missionId_status_idx" ON "HumanApprovalRequest"("missionId", "status");

CREATE TABLE "ImplementationPlan" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "architectureCompositionId" TEXT NOT NULL, "architectureHash" TEXT NOT NULL,
  "requirementBaselineId" TEXT NOT NULL, "requirementBaselineHash" TEXT NOT NULL,
  "scopeCoverageHash" TEXT NOT NULL, "plannerAgentExecutionId" TEXT NOT NULL,
  "plannerAgentDefinitionKey" TEXT NOT NULL, "plannerAgentDefinitionVersion" INTEGER NOT NULL,
  "promptSnapshotId" TEXT NOT NULL, "resultHash" TEXT NOT NULL, "planHash" TEXT NOT NULL,
  "summary" TEXT NOT NULL, "workPackagesJson" JSONB NOT NULL DEFAULT '[]',
  "risksJson" JSONB NOT NULL DEFAULT '[]', "assumptionsJson" JSONB NOT NULL DEFAULT '[]',
  "confidence" DOUBLE PRECISION NOT NULL, "status" TEXT NOT NULL DEFAULT 'VALIDATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "approvedAt" TIMESTAMP(3),
  CONSTRAINT "ImplementationPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImplementationPlan_architectureCompositionId_key" ON "ImplementationPlan"("architectureCompositionId");
CREATE UNIQUE INDEX "ImplementationPlan_missionId_version_key" ON "ImplementationPlan"("missionId", "version");
CREATE INDEX "ImplementationPlan_missionId_status_idx" ON "ImplementationPlan"("missionId", "status");

CREATE TABLE "MissionAssembly" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "architectureCompositionId" TEXT NOT NULL,
  "implementationPlanId" TEXT, "virtualCompanyId" TEXT, "status" TEXT NOT NULL DEFAULT 'PLANNING',
  "errorCode" TEXT, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionAssembly_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MissionAssembly_architectureCompositionId_key" ON "MissionAssembly"("architectureCompositionId");
CREATE INDEX "MissionAssembly_missionId_status_idx" ON "MissionAssembly"("missionId", "status");

CREATE TABLE "MissionJob" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "implementationPlanId" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL, "title" TEXT NOT NULL, "moduleKey" TEXT NOT NULL,
  "objective" TEXT NOT NULL, "requirementKeysJson" JSONB NOT NULL DEFAULT '[]',
  "requiredCapabilitiesJson" JSONB NOT NULL DEFAULT '[]', "dependencyKeysJson" JSONB NOT NULL DEFAULT '[]',
  "complexity" TEXT NOT NULL, "risk" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MissionJob_implementationPlanId_jobKey_key" ON "MissionJob"("implementationPlanId", "jobKey");
CREATE INDEX "MissionJob_missionId_status_idx" ON "MissionJob"("missionId", "status");

ALTER TABLE "VirtualCompany" ADD COLUMN "implementationPlanId" TEXT;
ALTER TABLE "JobScope" ALTER COLUMN "generationJobId" DROP NOT NULL;
ALTER TABLE "JobScope" ADD COLUMN "missionJobId" TEXT;
CREATE UNIQUE INDEX "JobScope_missionJobId_key" ON "JobScope"("missionJobId");
