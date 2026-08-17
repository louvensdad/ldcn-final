-- CreateTable
CREATE TABLE "DiscoveryConversation" (
    "missionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawUserIdea" TEXT NOT NULL,
    "interpretedIntent" TEXT,
    "domain" TEXT,
    "goal" TEXT,
    "targetUsers" JSONB,
    "knownRequirements" JSONB,
    "unknowns" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentQuestion" JSONB,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "handedOffAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryConversation_pkey" PRIMARY KEY ("missionId")
);

-- CreateTable
CREATE TABLE "DiscoveryMessage" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSuggestion" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptMasterVersion" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "vision" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "featuresJson" JSONB NOT NULL,
    "flowJson" JSONB NOT NULL,
    "outOfScopeJson" JSONB NOT NULL,
    "fullMarkdown" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PromptMasterVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryMessage_missionId_createdAt_idx" ON "DiscoveryMessage"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSuggestion_missionId_status_idx" ON "FeatureSuggestion"("missionId", "status");

-- CreateIndex
CREATE INDEX "PromptMasterVersion_missionId_status_idx" ON "PromptMasterVersion"("missionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromptMasterVersion_missionId_version_key" ON "PromptMasterVersion"("missionId", "version");

