import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/mission-pipeline-plan.ts (PipelineNode). */
export interface PipelineNodeDto {
  id: string;
  key: string;
  type: string;
  target?: string;
  targetKinds?: string[];
  stackKey?: string;
  required: boolean;
  dependsOn: string[];
  ownerRole: string;
  contractRefs: string[];
  gateRefs: string[];
  state: 'PENDING' | 'BLOCKED_UNSUPPORTED_RUNTIME';
  blockedReason?: string;
}

export interface PipelineDependencyDto {
  fromNodeKey: string;
  toNodeKey: string;
}

/** Wire shape of GET /missions/:id/intelligent-generator/pipeline (MissionPipelinePlan). */
export interface MissionPipelinePlanDto {
  id: string;
  missionId: string;
  version: number;
  nodes: PipelineNodeDto[];
  dependencies: PipelineDependencyDto[];
  status: 'APPROVED' | 'BLOCKED_UNSUPPORTED_RUNTIME' | 'SUPERSEDED';
}

@Injectable({ providedIn: 'root' })
export class PipelineClient {
  private readonly api = inject(ApiClient);

  get(missionId: string): Observable<MissionPipelinePlanDto> {
    return this.api.get<MissionPipelinePlanDto>(`/missions/${missionId}/intelligent-generator/pipeline`);
  }
}
