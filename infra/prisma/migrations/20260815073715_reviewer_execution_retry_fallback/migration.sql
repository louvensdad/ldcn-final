-- AlterTable
ALTER TABLE "ReviewerExecution" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "fallbackUsed" BOOLEAN NOT NULL DEFAULT false;

