-- CreateTable
CREATE TABLE "MarketplaceGenerationScope" (
    "id" TEXT NOT NULL,
    "customizationPlanId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "solutionVersionId" TEXT NOT NULL,
    "referenceMissionId" TEXT NOT NULL,
    "derivedMissionId" TEXT NOT NULL,
    "derivedProjectId" TEXT,
    "changeClassesJson" JSONB NOT NULL DEFAULT '[]',
    "affectedSectionsJson" JSONB NOT NULL DEFAULT '[]',
    "requiresStackReselection" BOOLEAN NOT NULL DEFAULT false,
    "requiresArchitectureRecompute" BOOLEAN NOT NULL DEFAULT false,
    "requiresTeamRecompute" BOOLEAN NOT NULL DEFAULT false,
    "generationMode" TEXT NOT NULL DEFAULT 'TARGETED',
    "actualReuseJson" JSONB,
    "escalationsJson" JSONB NOT NULL DEFAULT '[]',
    "impactScore" DOUBLE PRECISION NOT NULL,
    "totalRequirements" INTEGER NOT NULL DEFAULT 0,
    "reusedRequirements" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceGenerationScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceGenerationScope_customizationPlanId_key" ON "MarketplaceGenerationScope"("customizationPlanId");

-- CreateIndex
CREATE INDEX "MarketplaceGenerationScope_solutionId_createdAt_idx" ON "MarketplaceGenerationScope"("solutionId", "createdAt");

