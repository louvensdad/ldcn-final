-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "firstAttemptErrorCode" TEXT;

