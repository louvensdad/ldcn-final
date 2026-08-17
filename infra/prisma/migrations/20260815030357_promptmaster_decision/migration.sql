-- CreateTable
CREATE TABLE "PromptMasterDecision" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "promptMasterId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "chosenOption" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptMasterDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptMasterDecision_missionId_promptMasterId_idx" ON "PromptMasterDecision"("missionId", "promptMasterId");

