-- CreateTable
CREATE TABLE "ReviewFinding" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "promptMasterId" TEXT NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "section" TEXT,
    "requirementIdsJson" JSONB NOT NULL,
    "finding" TEXT NOT NULL,
    "recommendedResolutionsJson" JSONB NOT NULL,
    "requiresUserDecision" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewFinding_missionId_promptMasterId_idx" ON "ReviewFinding"("missionId", "promptMasterId");

-- CreateIndex
CREATE INDEX "ReviewFinding_missionId_severity_status_idx" ON "ReviewFinding"("missionId", "severity", "status");

