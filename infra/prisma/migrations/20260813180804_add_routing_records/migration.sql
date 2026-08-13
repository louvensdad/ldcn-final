-- CreateTable
CREATE TABLE "JobClassificationRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobClassificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRoutingDecisionRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkRoutingDecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSwitchDecisionRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "switchKey" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSwitchDecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobClassificationRecord_contextKey_key" ON "JobClassificationRecord"("contextKey");

-- CreateIndex
CREATE INDEX "JobClassificationRecord_missionId_taskId_createdAt_idx" ON "JobClassificationRecord"("missionId", "taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkRoutingDecisionRecord_routingKey_key" ON "WorkRoutingDecisionRecord"("routingKey");

-- CreateIndex
CREATE INDEX "WorkRoutingDecisionRecord_missionId_taskId_idx" ON "WorkRoutingDecisionRecord"("missionId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSwitchDecisionRecord_switchKey_key" ON "TeamSwitchDecisionRecord"("switchKey");

-- CreateIndex
CREATE INDEX "TeamSwitchDecisionRecord_missionId_taskId_createdAt_idx" ON "TeamSwitchDecisionRecord"("missionId", "taskId", "createdAt");
