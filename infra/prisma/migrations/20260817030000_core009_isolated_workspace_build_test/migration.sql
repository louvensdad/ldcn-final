-- CORE-009: isolated candidate workspace and deterministic build/test evidence.
CREATE TABLE "WorkspaceSession" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "agentExecutionId" TEXT,
    "status" TEXT NOT NULL,
    "rootRef" TEXT NOT NULL,
    "changeSetHash" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "inspectionHash" TEXT NOT NULL,
    "repositoryFingerprint" TEXT NOT NULL,
    "baselineFingerprint" TEXT NOT NULL,
    "candidateFingerprint" TEXT,
    "manifestHash" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    CONSTRAINT "WorkspaceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceCandidateManifest" (
    "id" TEXT NOT NULL,
    "workspaceSessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "changeSetHash" TEXT NOT NULL,
    "filesJson" JSONB NOT NULL DEFAULT '[]',
    "manifestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceCandidateManifest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuildValidationRun" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "workspaceSessionId" TEXT NOT NULL,
    "changeSetHash" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "candidateFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "commandProfile" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "exitCode" INTEGER,
    "stdoutHash" TEXT,
    "stderrHash" TEXT,
    "safeSummary" TEXT,
    CONSTRAINT "BuildValidationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestValidationRun" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "workspaceSessionId" TEXT NOT NULL,
    "changeSetHash" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "candidateFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "commandProfile" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "exitCode" INTEGER,
    "passedCount" INTEGER,
    "failedCount" INTEGER,
    "skippedCount" INTEGER,
    "stdoutHash" TEXT,
    "stderrHash" TEXT,
    "safeSummary" TEXT,
    CONSTRAINT "TestValidationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceSession_generationJobId_changeSetHash_baselineFingerprint_idx" ON "WorkspaceSession"("generationJobId", "changeSetHash", "baselineFingerprint");
CREATE INDEX "WorkspaceSession_missionId_status_idx" ON "WorkspaceSession"("missionId", "status");
CREATE UNIQUE INDEX "WorkspaceCandidateManifest_workspaceSessionId_key" ON "WorkspaceCandidateManifest"("workspaceSessionId");
CREATE INDEX "WorkspaceCandidateManifest_missionId_idx" ON "WorkspaceCandidateManifest"("missionId");
CREATE INDEX "BuildValidationRun_workspaceSessionId_idx" ON "BuildValidationRun"("workspaceSessionId");
CREATE INDEX "BuildValidationRun_missionId_idx" ON "BuildValidationRun"("missionId");
CREATE INDEX "TestValidationRun_workspaceSessionId_idx" ON "TestValidationRun"("workspaceSessionId");
CREATE INDEX "TestValidationRun_missionId_idx" ON "TestValidationRun"("missionId");
