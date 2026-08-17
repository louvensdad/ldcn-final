-- CreateTable
CREATE TABLE "ProviderCredential" (
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "ProviderCredentialAudit" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCredentialAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderCredentialAudit_provider_createdAt_idx" ON "ProviderCredentialAudit"("provider", "createdAt");

