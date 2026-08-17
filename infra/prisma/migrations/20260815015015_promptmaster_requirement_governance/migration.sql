-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "promptMasterId" TEXT,
    "section" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentRequirementId" TEXT,
    "evidence" TEXT,
    "reasoningSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Requirement_missionId_promptMasterId_section_idx" ON "Requirement"("missionId", "promptMasterId", "section");
CREATE INDEX "Requirement_missionId_status_idx" ON "Requirement"("missionId", "status");
CREATE INDEX "Requirement_parentRequirementId_idx" ON "Requirement"("parentRequirementId");

-- AlterTable: add new PromptMasterVersion columns first, keep old ones until data is migrated.
ALTER TABLE "PromptMasterVersion" ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'discovery-ai';
ALTER TABLE "PromptMasterVersion" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Data migration: carry over existing FeatureSuggestion rows (created during Discovery, before any
-- PromptMasterVersion exists) into Requirement as section='features'. Status vocabulary maps
-- PENDING->SUGGESTED, ACCEPTED->CONFIRMED, REJECTED->REJECTED (never invents an approval that
-- didn't happen: ACCEPTED already was a real user decision, so approvedAt/approvedBy are set).
INSERT INTO "Requirement" (
  "id", "missionId", "promptMasterId", "section", "content", "origin", "status",
  "createdBy", "createdAt", "approvedBy", "approvedAt", "version", "updatedAt", "reasoningSummary"
)
SELECT
  'req-' || fs."id",
  fs."missionId",
  NULL,
  'features',
  fs."title" || CASE WHEN fs."description" IS NOT NULL AND fs."description" <> '' THEN ' — ' || fs."description" ELSE '' END,
  CASE fs."origin" WHEN 'INFERRED' THEN 'AI_SUGGESTED' ELSE 'AI_SUGGESTED' END,
  CASE fs."status" WHEN 'PENDING' THEN 'SUGGESTED' WHEN 'ACCEPTED' THEN 'CONFIRMED' WHEN 'REJECTED' THEN 'REJECTED' ELSE 'SUGGESTED' END,
  'discovery-ai',
  fs."createdAt",
  CASE WHEN fs."status" IN ('ACCEPTED', 'REJECTED') THEN 'user' ELSE NULL END,
  CASE WHEN fs."status" IN ('ACCEPTED', 'REJECTED') THEN fs."updatedAt" ELSE NULL END,
  1,
  fs."updatedAt",
  fs."reason"
FROM "FeatureSuggestion" fs;

-- Data migration: carry over already-generated PromptMasterVersion.featuresJson/flowJson/
-- outOfScopeJson arrays into Requirement, tagged with the version they came from and
-- origin=AI_REFINED (the PromptMaster generation step already consolidated them from confirmed
-- Discovery requirements), status=CONFIRMED (they were part of an already-generated document).
INSERT INTO "Requirement" ("id", "missionId", "promptMasterId", "section", "content", "origin", "status", "createdBy", "createdAt", "version", "updatedAt")
SELECT 'req-pm-' || pmv."id" || '-features-' || item.ord, pmv."missionId", pmv."id", 'features', item.value, 'AI_REFINED', 'CONFIRMED', 'promptmaster-ai', pmv."createdAt", 1, pmv."createdAt"
FROM "PromptMasterVersion" pmv, jsonb_array_elements_text(pmv."featuresJson"::jsonb) WITH ORDINALITY AS item(value, ord);

INSERT INTO "Requirement" ("id", "missionId", "promptMasterId", "section", "content", "origin", "status", "createdBy", "createdAt", "version", "updatedAt")
SELECT 'req-pm-' || pmv."id" || '-flows-' || item.ord, pmv."missionId", pmv."id", 'flows', item.value, 'AI_REFINED', 'CONFIRMED', 'promptmaster-ai', pmv."createdAt", 1, pmv."createdAt"
FROM "PromptMasterVersion" pmv, jsonb_array_elements_text(pmv."flowJson"::jsonb) WITH ORDINALITY AS item(value, ord);

INSERT INTO "Requirement" ("id", "missionId", "promptMasterId", "section", "content", "origin", "status", "createdBy", "createdAt", "version", "updatedAt")
SELECT 'req-pm-' || pmv."id" || '-outOfScope-' || item.ord, pmv."missionId", pmv."id", 'outOfScope', item.value, 'AI_REFINED', 'CONFIRMED', 'promptmaster-ai', pmv."createdAt", 1, pmv."createdAt"
FROM "PromptMasterVersion" pmv, jsonb_array_elements_text(pmv."outOfScopeJson"::jsonb) WITH ORDINALITY AS item(value, ord);

-- Status vocabulary migration on PromptMasterVersion itself: PENDING_APPROVAL -> PENDING_REVIEW,
-- APPROVED -> LOCKED (lockedAt backfilled from the old approvedAt).
UPDATE "PromptMasterVersion" SET "lockedAt" = "approvedAt", "status" = 'LOCKED' WHERE "status" = 'APPROVED';
UPDATE "PromptMasterVersion" SET "status" = 'PENDING_REVIEW' WHERE "status" = 'PENDING_APPROVAL';

-- Now safe to drop the columns/table the new model replaces.
ALTER TABLE "PromptMasterVersion" DROP COLUMN "approvedAt";
ALTER TABLE "PromptMasterVersion" DROP COLUMN "featuresJson";
ALTER TABLE "PromptMasterVersion" DROP COLUMN "flowJson";
ALTER TABLE "PromptMasterVersion" DROP COLUMN "outOfScopeJson";
ALTER TABLE "PromptMasterVersion" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TABLE "FeatureSuggestion";
