import { apiClient } from "./client";

export interface ExplainDecisionUsageDto {
  provider: "deepseek";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface ExplainDecisionResponseDto {
  explanation: string;
  usage: ExplainDecisionUsageDto;
}

/** "Ask AI" — narrates an already-made deterministic decision, never decides anything itself. */
export const assistantClient = {
  explainArchitectureDecision(missionId: string, decisionId: string): Promise<ExplainDecisionResponseDto> {
    return apiClient.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-architecture`, { decisionId });
  },
  explainTeamDecision(missionId: string, decisionId: string): Promise<ExplainDecisionResponseDto> {
    return apiClient.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-team`, { decisionId });
  },
  explainRoutingDecision(missionId: string, taskId: string): Promise<ExplainDecisionResponseDto> {
    return apiClient.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-routing`, { taskId });
  },
  explainRepairAdvisory(missionId: string, taskId: string): Promise<ExplainDecisionResponseDto> {
    return apiClient.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-repair`, { taskId });
  },
};
