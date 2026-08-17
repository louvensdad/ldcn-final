CREATE TABLE "VirtualCompany" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "architectureCompositionId" TEXT NOT NULL,
  "architectureHash" TEXT NOT NULL,
  "approvedSolutionId" TEXT NOT NULL,
  "compositionHash" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "composedBy" TEXT NOT NULL DEFAULT 'team-composer.v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "VirtualCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VirtualCompany_architectureCompositionId_key" ON "VirtualCompany"("architectureCompositionId");
CREATE UNIQUE INDEX "VirtualCompany_missionId_version_key" ON "VirtualCompany"("missionId", "version");
CREATE INDEX "VirtualCompany_missionId_status_idx" ON "VirtualCompany"("missionId", "status");

CREATE TABLE "TeamInstance" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "virtualCompanyId" TEXT NOT NULL,
  "unitDefinitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stackKeysJson" JSONB NOT NULL DEFAULT '[]',
  "rationale" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamInstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeamInstance_virtualCompanyId_unitDefinitionId_key" ON "TeamInstance"("virtualCompanyId", "unitDefinitionId");
CREATE INDEX "TeamInstance_missionId_idx" ON "TeamInstance"("missionId");

CREATE TABLE "TeamCompositionDecision" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "virtualCompanyId" TEXT NOT NULL,
  "teamInstanceId" TEXT NOT NULL,
  "agentDefinitionKey" TEXT NOT NULL,
  "agentDefinitionVersion" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "capabilityKeysJson" JSONB NOT NULL DEFAULT '[]',
  "architectureEvidenceJson" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamCompositionDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeamCompositionDecision_virtualCompanyId_agentDefinitionKey_key" ON "TeamCompositionDecision"("virtualCompanyId", "agentDefinitionKey");
CREATE INDEX "TeamCompositionDecision_missionId_idx" ON "TeamCompositionDecision"("missionId");

ALTER TABLE "AgentInstance"
ADD COLUMN "virtualCompanyId" TEXT,
ADD COLUMN "teamInstanceId" TEXT,
ADD COLUMN "role" TEXT,
ADD COLUMN "compositionRationale" TEXT;
CREATE INDEX "AgentInstance_virtualCompanyId_idx" ON "AgentInstance"("virtualCompanyId");
CREATE INDEX "AgentInstance_teamInstanceId_idx" ON "AgentInstance"("teamInstanceId");
