-- CreateTable
CREATE TABLE "DecisionEvent" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningOutcome" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "taskId" TEXT,
    "outcomeType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDispatch" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "routingDecisionId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureSnapshot" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairAdvisory" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairAdvisory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewGateEvaluation" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewGateEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratorMissionState" (
    "missionId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "lastReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratorMissionState_pkey" PRIMARY KEY ("missionId")
);

-- CreateTable
CREATE TABLE "GenerationResult" (
    "missionId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationResult_pkey" PRIMARY KEY ("missionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionEvent_idempotencyKey_key" ON "DecisionEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DecisionEvent_missionId_createdAt_idx" ON "DecisionEvent"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionEvent_missionId_eventType_idx" ON "DecisionEvent"("missionId", "eventType");

-- CreateIndex
CREATE INDEX "DecisionEvent_missionId_aggregateType_aggregateId_idx" ON "DecisionEvent"("missionId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionEvent_missionId_version_key" ON "DecisionEvent"("missionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LearningOutcome_outcomeKey_key" ON "LearningOutcome"("outcomeKey");

-- CreateIndex
CREATE INDEX "LearningOutcome_missionId_createdAt_idx" ON "LearningOutcome"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningOutcome_missionId_outcomeType_idx" ON "LearningOutcome"("missionId", "outcomeType");

-- CreateIndex
CREATE UNIQUE INDEX "LearningOutcome_missionId_version_key" ON "LearningOutcome"("missionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDispatch_idempotencyKey_key" ON "ExecutionDispatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExecutionDispatch_missionId_taskId_idx" ON "ExecutionDispatch"("missionId", "taskId");

-- CreateIndex
CREATE INDEX "ExecutionDispatch_executionId_idx" ON "ExecutionDispatch"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDispatch_missionId_taskId_contextHash_key" ON "ExecutionDispatch"("missionId", "taskId", "contextHash");

-- CreateIndex
CREATE UNIQUE INDEX "FailureSnapshot_contextHash_key" ON "FailureSnapshot"("contextHash");

-- CreateIndex
CREATE INDEX "FailureSnapshot_missionId_taskId_createdAt_idx" ON "FailureSnapshot"("missionId", "taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairAdvisory_contextHash_key" ON "RepairAdvisory"("contextHash");

-- CreateIndex
CREATE INDEX "RepairAdvisory_missionId_taskId_createdAt_idx" ON "RepairAdvisory"("missionId", "taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewGateEvaluation_idempotencyKey_key" ON "ReviewGateEvaluation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReviewGateEvaluation_missionId_taskId_createdAt_idx" ON "ReviewGateEvaluation"("missionId", "taskId", "createdAt");
