-- CreateTable
CREATE TABLE "PromptMasterChangeRequest" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "fromPromptMasterId" TEXT NOT NULL,
    "toPromptMasterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptMasterChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptMasterChangeRequest_missionId_createdAt_idx" ON "PromptMasterChangeRequest"("missionId", "createdAt");

