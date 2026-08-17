-- AlterTable
ALTER TABLE "PromptSnapshot" ADD COLUMN     "agentDefinitionKey" TEXT,
ADD COLUMN     "agentDefinitionVersion" INTEGER,
ADD COLUMN     "artifactRefsJson" JSONB,
ADD COLUMN     "capabilityRefsJson" JSONB,
ADD COLUMN     "compiledPromptHash" TEXT,
ADD COLUMN     "contractRefsJson" JSONB,
ADD COLUMN     "knowledgeRefsJson" JSONB,
ADD COLUMN     "promptTemplateKey" TEXT,
ADD COLUMN     "promptTemplateVersion" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "requirementRefsJson" JSONB;
