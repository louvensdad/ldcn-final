import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { OperationDto } from './operation.client';

/** MissionOverviewReadModel wire shape (doc 36 §70), from GET /missions/:id/overview. */
export interface MissionOverviewDto {
  missionId: string;
  generatorState?: string;
  currentOperation: OperationDto | null;
  intentSummary: { rawUserIdea: string; problemStatement: string; confidence: number; status: string };
  requirementsSummary: { itemCount: number; status: string };
  topologySummary: { requiredTargets: string[]; status: string };
  solutionSummary: { selectedStackCount: number; deliveryTargetCount: number; status: string };
  architectureSummary: { proposalCount: number; conflictCount: number; status: string };
  teamSummary: { instanceCount: number; status: string };
  pipelineSummary: { nodeCount: number; blockedNodeCount: number; status: string };
  taskSummary: unknown | null;
  artifactSummary: unknown | null;
  reviewSummary: unknown | null;
  gateSummary: unknown | null;
  aiUsageSummary: unknown | null;
  costSummary: unknown | null;
  nextAction: string;
  blockers: string[];
}

@Injectable({ providedIn: 'root' })
export class MissionClient {
  private readonly api = inject(ApiClient);

  getOverview(missionId: string): Observable<MissionOverviewDto> {
    return this.api.get<MissionOverviewDto>(`/missions/${missionId}/overview`);
  }
}
