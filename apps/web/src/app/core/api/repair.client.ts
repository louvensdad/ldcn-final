import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/failure-snapshot.ts (FailureSnapshot). */
export interface FailureSnapshotDto {
  id: string;
  missionId: string;
  version: number;
  taskId: string;
  executionId: string;
  category: 'BUILD' | 'TEST' | 'RUNTIME' | 'INTEGRATION' | 'SECURITY' | 'UNKNOWN';
  failureCode: string;
  summary: string;
  evidenceRefs: string[];
  affectedStack?: string;
  failedGateKey?: string;
  contextHash: string;
}

/** Mirrors core/src/domain/repair-advisory.ts (RepairAdvisory). */
export interface RepairAdvisoryDto {
  id: string;
  missionId: string;
  version: number;
  taskId: string;
  failureSnapshotId?: string;
  approvedSolutionId: string;
  failureCode: string;
  likelyCapabilities: string[];
  likelySpecialistRole: string;
  estimatedSuccess: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
  status: 'ADVISORY_ONLY';
  contextHash: string;
}

/** Mirrors core/src/domain/repair-eligibility.ts (RepairEligibilityDecision). */
export interface RepairEligibilityDecisionDto {
  id: string;
  missionId: string;
  version: number;
  taskId: string;
  attemptCount: number;
  maxAttempts: number;
  status: 'ELIGIBLE' | 'BLOCKED';
  reason: string;
  requiresApproval: boolean;
}

export interface ClassifyFailureRequest {
  executionId: string;
  summary: string;
  evidenceRefs?: string[];
  affectedStack?: string;
  failedGateKey?: string;
}

export interface AssessEligibilityRequest {
  approvalGranted?: boolean;
  maxAttempts?: number;
}

export interface RepairOverviewDto {
  snapshot?: FailureSnapshotDto;
  advisory?: RepairAdvisoryDto;
}

/** Wire client for POST .../repair/classify, POST .../repair/eligibility (the real approval action), GET .../repair. */
@Injectable({ providedIn: 'root' })
export class RepairClient {
  private readonly api = inject(ApiClient);

  classify(missionId: string, taskId: string, body: ClassifyFailureRequest): Observable<{ snapshot: FailureSnapshotDto; advisory: RepairAdvisoryDto }> {
    return this.api.post(`/missions/${missionId}/tasks/${taskId}/repair/classify`, body);
  }

  assessEligibility(missionId: string, taskId: string, body: AssessEligibilityRequest): Observable<RepairEligibilityDecisionDto> {
    return this.api.post(`/missions/${missionId}/tasks/${taskId}/repair/eligibility`, body);
  }

  getOverview(missionId: string, taskId: string): Observable<RepairOverviewDto> {
    return this.api.get(`/missions/${missionId}/tasks/${taskId}/repair`);
  }
}
