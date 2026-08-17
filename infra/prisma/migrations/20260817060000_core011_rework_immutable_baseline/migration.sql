-- CORE-011 REWORK 01: freeze canonical Requirement content in each baseline.
ALTER TABLE "RequirementBaseline"
ADD COLUMN "requirementsSnapshotJson" JSONB NOT NULL DEFAULT '[]';

-- Best-effort one-time seal for baselines created before this migration. New baselines are written
-- atomically by RequirementBaselineService with a hash computed over this exact snapshot.
UPDATE "RequirementBaseline" AS baseline
SET "requirementsSnapshotJson" = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'requirementId', ref.item ->> 'requirementId',
      'requirementKey', ref.item ->> 'requirementKey',
      'category', requirement."category",
      'statement', requirement."content",
      'source', requirement."source",
      'sourceRef', requirement."sourceRef",
      'priority', requirement."priority",
      'status', requirement."status"
    ) ORDER BY ref.ordinality
  )
  FROM jsonb_array_elements(baseline."requirementRefsJson") WITH ORDINALITY AS ref(item, ordinality)
  LEFT JOIN "Requirement" AS requirement ON requirement."id" = ref.item ->> 'requirementId'
), '[]'::jsonb)
WHERE baseline."requirementsSnapshotJson" = '[]'::jsonb;
