import { T } from "../../design/tokens";
import type { MissionSummaryDto } from "../../api/mission.client";

/**
 * The only "status" the backend actually gives us (GeneratorState) plus the real blockers list —
 * no fabricated risk/priority fields. BLOCKED wins over everything else since a mission can carry
 * blockers while technically sitting in an earlier in-pipeline state.
 */
export type MissionStatus = "blocked" | "completed" | "cancelled" | "active" | "inProgress";

export function missionStatus(mission: Pick<MissionSummaryDto, "generatorState" | "blockers">): MissionStatus {
  if (mission.generatorState === "BLOCKED" || mission.blockers.length > 0) return "blocked";
  if (mission.generatorState === "COMPLETED") return "completed";
  if (mission.generatorState === "CANCELLED") return "cancelled";
  if (mission.generatorState === "ACTIVE") return "active";
  return "inProgress";
}

export const MISSION_STATUS_COLOR: Record<MissionStatus, string> = {
  blocked: T.red,
  completed: T.emerald,
  cancelled: T.textMuted,
  active: T.emerald,
  inProgress: T.amber,
};

export const MISSION_STATUS_LABEL_KEY: Record<MissionStatus, string> = {
  blocked: "missionStatus.blocked",
  completed: "missionStatus.completed",
  cancelled: "missionStatus.cancelled",
  active: "missionStatus.active",
  inProgress: "missionStatus.inProgress",
};
