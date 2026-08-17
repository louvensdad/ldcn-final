import { apiClient } from "./client";

/** Mirrors core/src/domain/review-gate.ts (ReviewGateEvidence). reviewerAgentInstanceId/executorAgentInstanceId deliberately omitted — no agent picker exists yet, and omitting both never triggers the self-review guard. */
export interface ReviewGateEvidenceDto {
  gateKey: string;
  passed: boolean;
  evidenceRefs: string[];
}

/** Mirrors core/src/domain/review-gate.ts (ReviewGateEvaluation). */
export interface ReviewGateEvaluationDto {
  id: string;
  missionId: string;
  version: number;
  taskId: string;
  routingDecisionId: string;
  requiredGateKeys: string[];
  evaluatedGateKeys: string[];
  missingGateKeys: string[];
  failedGateKeys: string[];
  duplicateGateKeys: string[];
  unauthorizedReviewerAgentIds: string[];
  unexpectedGateKeys: string[];
  evidenceRefs: string[];
  status: "PASSED" | "FAILED" | "BLOCKED";
  reason: string;
  evidenceHash: string;
}

export interface GateOverviewDto {
  evaluation?: ReviewGateEvaluationDto;
}

export const gateClient = {
  evaluate(missionId: string, taskId: string, evidence: ReviewGateEvidenceDto[]): Promise<ReviewGateEvaluationDto> {
    return apiClient.post<ReviewGateEvaluationDto>(`/missions/${missionId}/tasks/${taskId}/gates/evaluate`, { evidence });
  },
  getOverview(missionId: string, taskId: string): Promise<GateOverviewDto> {
    return apiClient.get<GateOverviewDto>(`/missions/${missionId}/tasks/${taskId}/gates`);
  },
};
