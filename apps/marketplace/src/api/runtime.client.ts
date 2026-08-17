import { apiClient } from "./client";

/** Mirrors core/src/domain/operational-overview.ts (OperationalMissionOverview). */
export interface OperationalMissionOverviewDto {
  missionId: string;
  runtimeTaskCount: number;
  runningTaskCount: number;
  failedTaskCount: number;
  reviewPendingCount: number;
  repairPendingCount: number;
  retryPendingCount: number;
}

/** Mirrors core/src/domain/operational-action.ts (OperationalAction). */
export interface OperationalActionDto {
  missionId: string;
  taskId: string;
  action: "WAIT_RUNTIME" | "REVIEW" | "REPAIR_ADVISORY" | "RETRY_EXECUTION" | "START_REPAIR" | "APPROVE_REPAIR";
  source: "RUNTIME" | "REPAIR";
}

/** Mirrors core/src/domain/runtime-overview.ts (RuntimeTaskOverview). */
export interface RuntimeTaskOverviewDto {
  missionId: string;
  taskId: string;
  executionId?: string;
  executionStatus: "DISPATCHED" | "COMPLETED" | "FAILED" | "UNKNOWN";
  attemptCount: number;
  lastGateStatus?: "PASSED" | "FAILED" | "BLOCKED";
  advisoryCount: number;
  outcomeCount: number;
  nextAction: "WAIT_RUNTIME" | "REVIEW" | "REPAIR_ADVISORY" | "RETRY_EXECUTION" | "NONE";
}

/** Mirrors core/src/domain/repair-overview.ts (RepairOverview) — the /operations aggregate's per-task repair status, distinct from repair.client's task-level RepairOverviewDto (snapshot + advisory). */
export interface RepairOperationalOverviewDto {
  missionId: string;
  taskId: string;
  failureSnapshotId?: string;
  failureCategory?: string;
  failureCode?: string;
  risk?: string;
  repairCompleted?: boolean;
  nextAction: "CLASSIFY_FAILURE" | "REVIEW_ADVISORY" | "APPROVE_REPAIR" | "START_REPAIR" | "RETRY_EXECUTION" | "NONE";
}

/** Wire shape of GET /missions/:id/operations. */
export interface RuntimeOperationalResponseDto {
  overview: OperationalMissionOverviewDto;
  actions: OperationalActionDto[];
  runtimeTasks: RuntimeTaskOverviewDto[];
  repairTasks: RepairOperationalOverviewDto[];
}

/** Mirrors core/src/domain/decision-event.ts (GeneratorDecisionEvent). */
export interface DecisionEventDto {
  id: string;
  missionId: string;
  version: number;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, string | number | boolean | null>;
  createdAt: number;
}

/** Wire shape of GET /missions/:id/operations/events. */
export interface RuntimeEventsResponseDto {
  runtime: DecisionEventDto[];
  repair: DecisionEventDto[];
}

export const runtimeClient = {
  getMission(missionId: string): Promise<RuntimeOperationalResponseDto> {
    return apiClient.get<RuntimeOperationalResponseDto>(`/missions/${missionId}/operations`);
  },
  getEvents(missionId: string): Promise<RuntimeEventsResponseDto> {
    return apiClient.get<RuntimeEventsResponseDto>(`/missions/${missionId}/operations/events`);
  },
};
