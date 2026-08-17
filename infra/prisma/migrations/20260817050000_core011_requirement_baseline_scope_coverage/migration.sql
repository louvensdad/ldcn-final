-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "category" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "requirementKey" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "ReviewRecord" ALTER COLUMN "confidence" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RequirementKeySequence" (
    "missionId" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RequirementKeySequence_pkey" PRIMARY KEY ("missionId")
);

-- CreateTable
CREATE TABLE "RequirementBaseline" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "requirementRefsJson" JSONB NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "RequirementBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeCoverageDecision" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "requirementKey" TEXT NOT NULL,
    "requirementBaselineId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decisionSource" TEXT NOT NULL,
    "approvalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "ScopeCoverageDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequirementBaseline_missionId_status_idx" ON "RequirementBaseline"("missionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementBaseline_missionId_version_key" ON "RequirementBaseline"("missionId", "version");

-- CreateIndex
CREATE INDEX "ScopeCoverageDecision_missionId_requirementBaselineId_idx" ON "ScopeCoverageDecision"("missionId", "requirementBaselineId");

-- CreateIndex
CREATE INDEX "ScopeCoverageDecision_requirementId_requirementBaselineId_idx" ON "ScopeCoverageDecision"("requirementId", "requirementBaselineId");

-- CreateIndex
CREATE INDEX "Requirement_missionId_requirementKey_idx" ON "Requirement"("missionId", "requirementKey");

-- RenameIndex
ALTER INDEX "ReviewRecord_workspaceSessionId_candidateFingerprint_reviewCycl" RENAME TO "ReviewRecord_workspaceSessionId_candidateFingerprint_review_key";

-- RenameIndex
ALTER INDEX "WorkspaceSession_generationJobId_changeSetHash_baselineFingerpr" RENAME TO "WorkspaceSession_generationJobId_changeSetHash_baselineFing_idx";
