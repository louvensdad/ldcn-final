import { apiClient } from "./client";

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

/** Wire shape of GET /missions/:id/intelligent-generator/team. */
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
  status: "PROPOSED" | "APPROVED";
}

export const teamClient = {
  get(missionId: string): Promise<AgentTeamDto> {
    return apiClient.get<AgentTeamDto>(`/missions/${missionId}/intelligent-generator/team`);
  },
};
