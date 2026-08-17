-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "purchaseId" TEXT,
ADD COLUMN     "sourceSolutionId" TEXT,
ADD COLUMN     "sourceSolutionVersionId" TEXT;

-- AlterTable
ALTER TABLE "PromptMasterVersion" ADD COLUMN     "customizationPlanId" TEXT,
ADD COLUMN     "sourceSolutionId" TEXT,
ADD COLUMN     "sourceSolutionVersionId" TEXT;

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "sourceRequirementId" TEXT,
ADD COLUMN     "sourceSolutionId" TEXT;

-- CreateTable
CREATE TABLE "MarketplaceSolution" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "category" TEXT NOT NULL,
    "industry" TEXT,
    "tagsJson" JSONB NOT NULL DEFAULT '[]',
    "pricingModel" TEXT NOT NULL DEFAULT 'FREE',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSolutionVersion" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "referenceMissionId" TEXT NOT NULL,
    "referencePromptMasterVersionId" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "stackSnapshotJson" JSONB NOT NULL,
    "validationSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "pricingSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "releaseNotes" TEXT,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceSolutionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCustomizationPlan" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "solutionVersionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL DEFAULT 'user',
    "businessContextJson" JSONB NOT NULL,
    "keepJson" JSONB NOT NULL DEFAULT '[]',
    "removeJson" JSONB NOT NULL DEFAULT '[]',
    "modifyJson" JSONB NOT NULL DEFAULT '[]',
    "addJson" JSONB NOT NULL DEFAULT '[]',
    "architectureImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "contractImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "dataImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "securityImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "testImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "documentationImpactsJson" JSONB NOT NULL DEFAULT '[]',
    "complexity" TEXT NOT NULL DEFAULT 'LOW',
    "architectureImpact" TEXT NOT NULL DEFAULT 'PATCH',
    "requiresArchitectureReview" BOOLEAN NOT NULL DEFAULT false,
    "requiresUserDecision" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceCustomizationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePricingQuote" (
    "id" TEXT NOT NULL,
    "customizationPlanId" TEXT,
    "solutionId" TEXT NOT NULL,
    "solutionVersionId" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "customizationPrice" INTEGER NOT NULL DEFAULT 0,
    "integrationPrice" INTEGER NOT NULL DEFAULT 0,
    "estimatedAiCost" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "calculationVersion" TEXT NOT NULL DEFAULT 'v1',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePricingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "solutionVersionId" TEXT NOT NULL,
    "customizationPlanId" TEXT,
    "pricingQuoteId" TEXT NOT NULL,
    "derivedProjectId" TEXT,
    "derivedMissionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "purchasedBy" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSolution_slug_key" ON "MarketplaceSolution"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceSolution_status_visibility_idx" ON "MarketplaceSolution"("status", "visibility");

-- CreateIndex
CREATE INDEX "MarketplaceSolutionVersion_solutionId_status_idx" ON "MarketplaceSolutionVersion"("solutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSolutionVersion_solutionId_version_key" ON "MarketplaceSolutionVersion"("solutionId", "version");

-- CreateIndex
CREATE INDEX "MarketplaceCustomizationPlan_solutionId_missionId_idx" ON "MarketplaceCustomizationPlan"("solutionId", "missionId");

-- CreateIndex
CREATE INDEX "MarketplacePurchase_solutionId_createdAt_idx" ON "MarketplacePurchase"("solutionId", "createdAt");

