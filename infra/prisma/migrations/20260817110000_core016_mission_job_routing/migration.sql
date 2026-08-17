CREATE TABLE "MissionJobRouting" (
  "id" TEXT NOT NULL, "missionId" TEXT NOT NULL, "missionJobId" TEXT NOT NULL,
  "implementationPlanId" TEXT NOT NULL, "virtualCompanyId" TEXT NOT NULL,
  "contextHash" TEXT NOT NULL, "status" TEXT NOT NULL,
  "executorAgentInstanceId" TEXT, "reviewerAgentInstanceId" TEXT,
  "selectedAgentIdsJson" JSONB NOT NULL DEFAULT '[]',
  "requiredCapabilitiesJson" JSONB NOT NULL DEFAULT '[]',
  "capabilityCoverageJson" JSONB NOT NULL DEFAULT '[]',
  "missingCapabilitiesJson" JSONB NOT NULL DEFAULT '[]',
  "rationale" TEXT NOT NULL, "routingSource" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionJobRouting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MissionJobRouting_missionJobId_key" ON "MissionJobRouting"("missionJobId");
CREATE INDEX "MissionJobRouting_missionId_status_idx" ON "MissionJobRouting"("missionId", "status");
CREATE INDEX "MissionJobRouting_implementationPlanId_idx" ON "MissionJobRouting"("implementationPlanId");
