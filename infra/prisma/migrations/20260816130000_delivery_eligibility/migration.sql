-- AlterTable
ALTER TABLE "MissionGenerationRun" ADD COLUMN     "deliveryEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirementCoverageJson" JSONB;

