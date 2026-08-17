import { T, alpha } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";

interface Stage {
  key: string;
  labelKey: string;
  states: string[];
}

type StageStatus = "done" | "current" | "pending";

/**
 * Grouped into the 8 sections the product docs use (Intent through Ready), each covering a few
 * of core's fine-grained GeneratorState values so the rail doesn't have 16+ noisy stops.
 * BLOCKED/CANCELLED are deliberately absent — every stop reads "pending" in those states, and
 * the real signal is the blockers list rendered separately by the caller.
 */
export const STAGES: Stage[] = [
  { key: "intent", labelKey: "stageRail.intent", states: ["INTENT_PENDING", "INTENT_READY"] },
  { key: "requirements", labelKey: "stageRail.requirements", states: ["REQUIREMENTS_DRAFT", "REQUIREMENTS_APPROVED"] },
  { key: "topology", labelKey: "stageRail.topology", states: ["TOPOLOGY_PROPOSED", "TOPOLOGY_APPROVED"] },
  { key: "solution", labelKey: "stageRail.solution", states: ["SOLUTION_PLANNING", "SOLUTION_PROPOSED", "SOLUTION_APPROVED"] },
  { key: "architecture", labelKey: "stageRail.architecture", states: ["ARCHITECTURE_COMPOSING", "ARCHITECTURE_REVIEW", "ARCHITECTURE_APPROVED"] },
  { key: "team", labelKey: "stageRail.team", states: ["TEAM_COMPOSING", "TEAM_READY"] },
  { key: "pipeline", labelKey: "stageRail.pipeline", states: ["PIPELINE_PLANNING"] },
  { key: "ready", labelKey: "stageRail.ready", states: ["READY_FOR_EXECUTION", "ACTIVE", "COMPLETED"] },
];

const KNOWN_SEQUENCE = STAGES.flatMap((stage) => stage.states);

function statusOf(stage: Stage, generatorState: string | undefined): StageStatus {
  if (!generatorState || !KNOWN_SEQUENCE.includes(generatorState)) return "pending";
  const currentIndex = KNOWN_SEQUENCE.indexOf(generatorState);
  const stageStartIndex = KNOWN_SEQUENCE.indexOf(stage.states[0]);
  const stageEndIndex = KNOWN_SEQUENCE.indexOf(stage.states[stage.states.length - 1]);
  if (currentIndex > stageEndIndex) return "done";
  if (currentIndex >= stageStartIndex) return "current";
  return "pending";
}

/**
 * Which of the 8 STAGES a mission is currently in, for callers that just need a single label
 * (Home/Missions/Projects) instead of the full rail. Falls back to the first stage for unknown
 * states so callers always get something to render.
 */
export function currentStageKey(generatorState: string | undefined): Stage["key"] {
  if (!generatorState) return STAGES[0].key;
  const stage = STAGES.find((s) => statusOf(s, generatorState) === "current");
  if (stage) return stage.key;
  // Terminal-ish states with no "current" match (e.g. COMPLETED lands past "ready" as "done"
  // for every stage) resolve to the last stage instead of falling through to the first.
  const allDone = STAGES.every((s) => statusOf(s, generatorState) === "done");
  return allDone ? STAGES[STAGES.length - 1].key : STAGES[0].key;
}

/**
 * Real, derived progress — position within the 8 known stages, never a fabricated time estimate
 * (the backend has no notion of "time remaining"). COMPLETED reads 100 even though "ready" is
 * technically stage 8 of 8, since completion is a stronger signal than merely reaching the last
 * stage.
 */
export function missionProgressPercent(generatorState: string | undefined): number {
  if (generatorState === "COMPLETED") return 100;
  const key = currentStageKey(generatorState);
  const index = STAGES.findIndex((s) => s.key === key);
  return Math.round(((index + 1) / STAGES.length) * 100);
}

const DOT_COLOR: Record<StageStatus, string> = { done: T.emerald, current: T.indigo, pending: T.borderStrong };

export function StageRail({ generatorState }: { generatorState?: string }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", padding: "4px 0" }}>
      {STAGES.map((stage, i) => {
        const status = statusOf(stage, generatorState);
        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DOT_COLOR[status],
                  boxShadow: status === "current" ? `0 0 0 3px ${alpha(T.indigo, 19)}` : "none",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: status === "current" ? 700 : 500, color: status === "pending" ? T.textMuted : T.textSub, whiteSpace: "nowrap" }}>
                {t(stage.labelKey)}
              </span>
            </div>
            {i < STAGES.length - 1 && <span style={{ width: 16, height: 1, background: T.border, flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}
