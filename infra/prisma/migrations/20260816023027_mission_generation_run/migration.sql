-- CreateTable
CREATE TABLE "MissionGenerationRun" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCAFFOLDING',
    "targetKind" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "workspacePath" TEXT NOT NULL,
    "scaffoldJson" JSONB,
    "buildJson" JSONB,
    "testJson" JSONB,
    "runtimeJson" JSONB,
    "downloadPath" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedArtifact" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "ownerAgent" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "symbolsJson" JSONB NOT NULL DEFAULT '[]',
    "importsJson" JSONB NOT NULL DEFAULT '[]',
    "exportsJson" JSONB NOT NULL DEFAULT '[]',
    "provenance" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'UNVALIDATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionGenerationRun_missionId_key" ON "MissionGenerationRun"("missionId");

-- CreateIndex
CREATE INDEX "GeneratedArtifact_missionId_generationRunId_idx" ON "GeneratedArtifact"("missionId", "generationRunId");

