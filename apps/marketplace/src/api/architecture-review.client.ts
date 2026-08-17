import { apiClient } from "./client";

/** Mirrors apps/api/src/architecture-review/architecture-review.service.ts. */
export interface ArchitectureReviewFindingDto {
  id: string;
  reviewerKey: string;
  code: string;
  severity: "INFO" | "ADVISORY" | "WARNING" | "BLOCKER";
  finding: string;
  recommendedResolutions: string[];
  requiresUserDecision: boolean;
  status: "OPEN" | "RESOLVED";
  resolvedBy: string | null;
  resolvedAt: string | null;
  chosenOption: string | null;
  createdAt: string;
}

export interface ArchitectureReviewerExecutionDto {
  reviewerKey: string;
  status: "PASSED" | "DEGRADED" | "FAILED_BLOCKING";
  criticality: "CRITICAL" | "HIGH";
  findingCount: number;
  latencyMs: number | null;
  errorCode: string | null;
}

export interface ArchitectureReviewSessionDto {
  missionId: string;
  status: "PENDING" | "APPROVED" | "REWORK_REQUIRED" | "BLOCKED";
  findings: ArchitectureReviewFindingDto[];
  executions: ArchitectureReviewerExecutionDto[];
}

export const architectureReviewClient = {
  start(missionId: string): Promise<ArchitectureReviewSessionDto> {
    return apiClient.post<ArchitectureReviewSessionDto>(`/missions/${missionId}/architecture-review/start`, {});
  },
  getSession(missionId: string): Promise<ArchitectureReviewSessionDto> {
    return apiClient.get<ArchitectureReviewSessionDto>(`/missions/${missionId}/architecture-review`);
  },
  resolveFinding(missionId: string, findingId: string): Promise<ArchitectureReviewSessionDto> {
    return apiClient.post<ArchitectureReviewSessionDto>(`/missions/${missionId}/architecture-review/findings/${findingId}/resolve`, {});
  },
  decideFinding(missionId: string, findingId: string, chosenOption: string): Promise<ArchitectureReviewSessionDto> {
    return apiClient.post<ArchitectureReviewSessionDto>(`/missions/${missionId}/architecture-review/findings/${findingId}/decide`, { chosenOption });
  },
};
