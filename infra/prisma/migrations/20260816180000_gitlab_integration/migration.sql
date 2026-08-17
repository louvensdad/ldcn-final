-- CreateTable
CREATE TABLE "GitlabCredential" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "encryptedToken" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "gitlabUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitlabCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitlabPush" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repoName" TEXT,
    "repoUrl" TEXT,
    "errorCode" TEXT,
    "logsExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitlabPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitlabPush_missionId_key" ON "GitlabPush"("missionId");

