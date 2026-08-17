-- CreateTable
CREATE TABLE "JobScope" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "allowedPathsJson" JSONB NOT NULL DEFAULT '[]',
    "allowedModulesJson" JSONB NOT NULL DEFAULT '[]',
    "allowedSymbolsJson" JSONB NOT NULL DEFAULT '[]',
    "forbiddenPathsJson" JSONB NOT NULL DEFAULT '[]',
    "requiredContractsJson" JSONB NOT NULL DEFAULT '[]',
    "acceptanceCriteriaJson" JSONB NOT NULL DEFAULT '[]',
    "scopeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobScopeValidation" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "agentExecutionId" TEXT,
    "jobScopeId" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "changeSetHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "findingsJson" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScopeValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobScope_generationJobId_key" ON "JobScope"("generationJobId");

-- CreateIndex
CREATE INDEX "JobScope_missionId_idx" ON "JobScope"("missionId");

-- CreateIndex
CREATE INDEX "JobScopeValidation_generationJobId_idx" ON "JobScopeValidation"("generationJobId");

-- CreateIndex
CREATE INDEX "JobScopeValidation_missionId_idx" ON "JobScopeValidation"("missionId");
