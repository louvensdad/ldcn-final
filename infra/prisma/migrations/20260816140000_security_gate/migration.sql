-- AlterTable
ALTER TABLE "MissionGenerationRun" ADD COLUMN     "securityJson" JSONB,
ADD COLUMN     "securityPassed" BOOLEAN NOT NULL DEFAULT false;

