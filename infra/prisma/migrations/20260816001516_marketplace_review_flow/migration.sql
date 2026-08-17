-- AlterTable
ALTER TABLE "MarketplaceCustomizationPlan" ADD COLUMN     "asIs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewAttemptCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MarketplaceSolutionVersion" ADD COLUMN     "revalidationNote" TEXT,
ADD COLUMN     "revalidationStatus" TEXT NOT NULL DEFAULT 'OK';

