-- CreateTable
CREATE TABLE "GithubCredential" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "encryptedToken" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubPush" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "repoName" TEXT,
    "repoUrl" TEXT,
    "errorCode" TEXT,
    "logsExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubPush_missionId_key" ON "GithubPush"("missionId");

