-- CreateTable
CREATE TABLE "ArchitectureReview" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "approvedSolutionId" TEXT NOT NULL,
    "architectureCompositionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchitectureReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchitectureReviewerExecution" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "architectureReviewId" TEXT NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchitectureReviewerExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchitectureReviewFinding" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "architectureReviewId" TEXT NOT NULL,
    "reviewerKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "recommendedResolutionsJson" JSONB NOT NULL DEFAULT '[]',
    "requiresUserDecision" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "chosenOption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchitectureReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchitectureReview_missionId_key" ON "ArchitectureReview"("missionId");

-- CreateIndex
CREATE INDEX "ArchitectureReviewerExecution_architectureReviewId_idx" ON "ArchitectureReviewerExecution"("architectureReviewId");

-- CreateIndex
CREATE INDEX "ArchitectureReviewFinding_architectureReviewId_idx" ON "ArchitectureReviewFinding"("architectureReviewId");

