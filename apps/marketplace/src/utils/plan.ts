import type { PlanTier } from "../types";

const PLAN_ORDER: PlanTier[] = ["free", "basic", "advanced", "pro"];

/** True when `itemPlan` requires more than the workspace's `currentPlan` (spec §09.2). */
export function isPlanLocked(itemPlan: PlanTier, currentPlan: PlanTier): boolean {
  return PLAN_ORDER.indexOf(itemPlan) > PLAN_ORDER.indexOf(currentPlan);
}
