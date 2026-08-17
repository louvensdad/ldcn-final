-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engineeringType" TEXT NOT NULL,
    "stackKeysJson" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unitDefinitionId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDefVersion" (
    "id" TEXT NOT NULL,
    "agentDefinitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "identityJson" JSONB NOT NULL,
    "roleMission" TEXT NOT NULL,
    "capabilityKeysJson" JSONB NOT NULL DEFAULT '[]',
    "knowledgeRefsJson" JSONB NOT NULL DEFAULT '[]',
    "promptTemplateKey" TEXT NOT NULL,
    "promptTemplateVersion" TEXT NOT NULL,
    "outputSchemaKey" TEXT NOT NULL,
    "allowedToolsJson" JSONB NOT NULL DEFAULT '[]',
    "territoryJson" JSONB NOT NULL DEFAULT '[]',
    "memoryPolicyJson" JSONB NOT NULL DEFAULT '{}',
    "reviewPolicyJson" JSONB NOT NULL DEFAULT '{}',
    "boundariesJson" JSONB NOT NULL DEFAULT '[]',
    "llmPolicyJson" JSONB,
    "canExecute" BOOLEAN NOT NULL DEFAULT false,
    "canReview" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canDelegate" BOOLEAN NOT NULL DEFAULT false,
    "cognitiveMode" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDefVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_key_key" ON "Department"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UnitDefinition_key_key" ON "UnitDefinition"("key");

-- CreateIndex
CREATE INDEX "UnitDefinition_departmentId_idx" ON "UnitDefinition"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityDefinition_key_key" ON "CapabilityDefinition"("key");

-- CreateIndex
CREATE INDEX "CapabilityDefinition_domain_idx" ON "CapabilityDefinition"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDefinition_key_key" ON "AgentDefinition"("key");

-- CreateIndex
CREATE INDEX "AgentDefinition_unitDefinitionId_idx" ON "AgentDefinition"("unitDefinitionId");

-- CreateIndex
CREATE INDEX "AgentDefVersion_agentDefinitionId_idx" ON "AgentDefVersion"("agentDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDefVersion_agentDefinitionId_version_key" ON "AgentDefVersion"("agentDefinitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_key_version_key" ON "PromptTemplate"("key", "version");
