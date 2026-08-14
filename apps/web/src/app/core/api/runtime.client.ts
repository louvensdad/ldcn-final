import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

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
  action: 'WAIT_RUNTIME' | 'REVIEW' | 'REPAIR_ADVISORY' | 'RETRY_EXECUTION' | 'START_REPAIR' | 'APPROVE_REPAIR';
  source: 'RUNTIME' | 'REPAIR';
}

/** Mirrors core/src/domain/runtime-overview.ts (RuntimeTaskOverview). */
export interface RuntimeTaskOverviewDto {
  missionId: string;
  taskId: string;
  executionId?: string;
  executionStatus: 'DISPATCHED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  attemptCount: number;
  lastGateStatus?: 'PASSED' | 'FAILED' | 'BLOCKED';
  advisoryCount: number;
  outcomeCount: number;
  nextAction: 'WAIT_RUNTIME' | 'REVIEW' | 'REPAIR_ADVISORY' | 'RETRY_EXECUTION' | 'NONE';
}

/** Mirrors core/src/domain/repair-overview.ts (RepairOverview). */
export interface RepairOverviewDto {
  missionId: string;
  taskId: string;
  failureSnapshotId?: string;
  failureCategory?: string;
  failureCode?: string;
  risk?: string;
  repairCompleted?: boolean;
  nextAction: 'CLASSIFY_FAILURE' | 'REVIEW_ADVISORY' | 'APPROVE_REPAIR' | 'START_REPAIR' | 'RETRY_EXECUTION' | 'NONE';
}

/** Wire shape of GET /missions/:id/operations (RuntimeOperationalResponse). */
export interface RuntimeOperationalResponseDto {
  overview: OperationalMissionOverviewDto;
  actions: OperationalActionDto[];
  runtimeTasks: RuntimeTaskOverviewDto[];
  repairTasks: RepairOverviewDto[];
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

@Injectable({ providedIn: 'root' })
export class RuntimeClient {
  private readonly api = inject(ApiClient);

  getMission(missionId: string): Observable<RuntimeOperationalResponseDto> {
    return this.api.get<RuntimeOperationalResponseDto>(`/missions/${missionId}/operations`);
  }

  getEvents(missionId: string): Observable<RuntimeEventsResponseDto> {
    return this.api.get<RuntimeEventsResponseDto>(`/missions/${missionId}/operations/events`);
  }
}
