-- CORE-008: append-only evidence for RepositoryInspector + DuplicateValidator.
CREATE TABLE "DuplicateValidation" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "agentExecutionId" TEXT,
    "changeSetHash" TEXT NOT NULL,
    "inspectionHash" TEXT NOT NULL,
    "repositoryFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "findingsJson" JSONB NOT NULL DEFAULT '[]',
    "candidateRefsJson" JSONB NOT NULL DEFAULT '[]',
    "coverageJson" JSONB NOT NULL DEFAULT '{}',
    "inspectionsJson" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateValidation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DuplicateValidation_generationJobId_idx" ON "DuplicateValidation"("generationJobId");
CREATE INDEX "DuplicateValidation_missionId_idx" ON "DuplicateValidation"("missionId");
