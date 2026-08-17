/** Mirrors core/src/domain/generator-overview.ts (GeneratorNextAction). */
export type GeneratorNextAction = "START_EXECUTION" | "RESOLVE_SCOPE_EXPANSION" | "REVIEW_JOB" | "RESOLVE_SOLUTION_SELECTION" | "NONE";

export const NEXT_ACTION_LABEL_KEY: Record<GeneratorNextAction, string> = {
  START_EXECUTION: "nextAction.startExecution",
  RESOLVE_SCOPE_EXPANSION: "nextAction.resolveScopeExpansion",
  REVIEW_JOB: "nextAction.reviewJob",
  RESOLVE_SOLUTION_SELECTION: "nextAction.resolveSolutionSelection",
  NONE: "nextAction.none",
};

/** Which nextAction values are genuinely "LDCN needs something from you" vs. just informational. */
const NEEDS_USER: Partial<Record<GeneratorNextAction, true>> = {
  RESOLVE_SCOPE_EXPANSION: true,
  REVIEW_JOB: true,
  RESOLVE_SOLUTION_SELECTION: true,
};

export function needsUserDecision(mission: { generatorState?: string; nextAction: string; blockers: string[] }): boolean {
  return NEEDS_USER[mission.nextAction as GeneratorNextAction] === true || mission.generatorState === "BLOCKED" || mission.blockers.length > 0;
}

export function nextActionLabelKey(nextAction: string): string {
  return NEXT_ACTION_LABEL_KEY[nextAction as GeneratorNextAction] ?? "nextAction.none";
}
