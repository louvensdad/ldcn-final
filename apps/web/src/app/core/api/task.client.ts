import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/job-classification.ts (JobClassification). */
export interface JobClassificationDto {
  id: string;
  missionId: string;
  taskId: string;
  jobType: string;
  deliveryTarget?: string;
  primaryStackKey?: string;
  affectedStacks: string[];
  affectedDomains: string[];
  complexity: string;
  riskLevel: string;
  requiredCapabilities: string[];
  requiresArchitectureReview: boolean;
  requiresSecurityReview: boolean;
  requiresDataSpecialist: boolean;
  requiresRuntimeSpecialist: boolean;
  requiresIntegration: boolean;
  scopeExpansionRequired: boolean;
  contextHash: string;
}

/** Mirrors core/src/domain/work-routing-decision.ts (WorkRoutingDecision). */
export interface WorkRoutingDecisionDto {
  id: string;
  missionId: string;
  version: number;
  taskId: string;
  approvedSolutionId: string;
  jobClassificationId: string;
  selectedTeamKey?: string;
  executorAgentInstanceId?: string;
  selectedAgentInstanceIds: string[];
  reviewerCandidateIds: string[];
  selectedReviewerIds: string[];
  requiredSpecialists: string[];
  requiredCapabilityKeys: string[];
  requiredGateKeys: string[];
  routingSource: string;
  confidence: number;
  rationale: string;
  contextHash: string;
  status: string;
}

/** Wire shape of GET /missions/:id/tasks (apps/api TasksController). */
export interface TaskSummaryDto {
  taskId: string;
  classification: JobClassificationDto;
  routingStatus?: string;
}

/** Wire shape of GET /missions/:id/tasks/:taskId/intelligent-routing. */
export interface TaskOverviewDto {
  classification?: JobClassificationDto;
  routing?: WorkRoutingDecisionDto;
}

@Injectable({ providedIn: 'root' })
export class TaskClient {
  private readonly api = inject(ApiClient);

  list(missionId: string): Observable<TaskSummaryDto[]> {
    return this.api.get<TaskSummaryDto[]>(`/missions/${missionId}/tasks`);
  }

  getOverview(missionId: string, taskId: string): Observable<TaskOverviewDto> {
    return this.api.get<TaskOverviewDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing`);
  }

  classify(missionId: string, taskId: string, description: string): Observable<JobClassificationDto> {
    return this.api.post<JobClassificationDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing/classify`, { description });
  }

  route(missionId: string, taskId: string): Observable<WorkRoutingDecisionDto> {
    return this.api.post<WorkRoutingDecisionDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing/route`, {});
  }
}
