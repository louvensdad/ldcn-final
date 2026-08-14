import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/review-gate.ts (ReviewGateEvidence). reviewerAgentInstanceId/executorAgentInstanceId deliberately omitted from this form — no agent picker exists yet, and omitting both never triggers the self-review guard. */
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
  status: 'PASSED' | 'FAILED' | 'BLOCKED';
  reason: string;
  evidenceHash: string;
}

export interface GateOverviewDto {
  evaluation?: ReviewGateEvaluationDto;
}

/** Wire client for POST .../gates/evaluate and GET .../gates. */
@Injectable({ providedIn: 'root' })
export class GateClient {
  private readonly api = inject(ApiClient);

  evaluate(missionId: string, taskId: string, evidence: ReviewGateEvidenceDto[]): Observable<ReviewGateEvaluationDto> {
    return this.api.post<ReviewGateEvaluationDto>(`/missions/${missionId}/tasks/${taskId}/gates/evaluate`, { evidence });
  }

  getOverview(missionId: string, taskId: string): Observable<GateOverviewDto> {
    return this.api.get<GateOverviewDto>(`/missions/${missionId}/tasks/${taskId}/gates`);
  }
}
