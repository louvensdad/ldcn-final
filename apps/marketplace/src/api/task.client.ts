import { apiClient } from "./client";

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

/** Wire shape of GET /missions/:id/tasks. */
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

export const taskClient = {
  list(missionId: string): Promise<TaskSummaryDto[]> {
    return apiClient.get<TaskSummaryDto[]>(`/missions/${missionId}/tasks`);
  },
  getOverview(missionId: string, taskId: string): Promise<TaskOverviewDto> {
    return apiClient.get<TaskOverviewDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing`);
  },
  classify(missionId: string, taskId: string, description: string): Promise<JobClassificationDto> {
    return apiClient.post<JobClassificationDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing/classify`, { description });
  },
  route(missionId: string, taskId: string): Promise<WorkRoutingDecisionDto> {
    return apiClient.post<WorkRoutingDecisionDto>(`/missions/${missionId}/tasks/${taskId}/intelligent-routing/route`, {});
  },
};
