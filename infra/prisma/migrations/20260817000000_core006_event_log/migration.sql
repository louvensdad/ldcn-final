-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "missionId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventLog_idempotencyKey_key" ON "EventLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EventLog_missionId_type_idx" ON "EventLog"("missionId", "type");

-- CreateIndex
CREATE INDEX "EventLog_correlationId_idx" ON "EventLog"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventLog_missionId_sequence_key" ON "EventLog"("missionId", "sequence");
