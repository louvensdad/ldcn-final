import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/agent-team.ts (AgentInstance). */
export interface AgentInstanceDto {
  id: string;
  agentKey: string;
  role: string;
  stackKey?: string;
  reason: string;
}

/** Mirrors core/src/domain/agent-team.ts (TeamCompositionDecision). */
export interface TeamCompositionDecisionDto {
  id: string;
  scope: string;
  problem: string;
  selectedOption: string;
  rationale: string;
  rulesApplied: string[];
  decidedBy: string;
}

/** Wire shape of GET /missions/:id/intelligent-generator/team (AgentTeam). */
export interface AgentTeamDto {
  id: string;
  missionId: string;
  version: number;
  approvedSolutionId: string;
  architectureCompositionId: string;
  complexityProfile: string;
  riskProfile: string;
  instances: AgentInstanceDto[];
  decisions: TeamCompositionDecisionDto[];
  status: 'PROPOSED' | 'APPROVED';
}

@Injectable({ providedIn: 'root' })
export class TeamClient {
  private readonly api = inject(ApiClient);

  get(missionId: string): Observable<AgentTeamDto> {
    return this.api.get<AgentTeamDto>(`/missions/${missionId}/intelligent-generator/team`);
  }
}
