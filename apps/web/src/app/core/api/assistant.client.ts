import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

export interface ExplainDecisionUsageDto {
  provider: 'deepseek';
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

/** doc 43 §5 "Ask AI" — narrates an already-made deterministic decision, never decides anything itself. */
@Injectable({ providedIn: 'root' })
export class AssistantClient {
  private readonly api = inject(ApiClient);

  explainArchitectureDecision(missionId: string, decisionId: string): Observable<ExplainDecisionResponseDto> {
    return this.api.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-architecture`, { decisionId });
  }

  explainTeamDecision(missionId: string, decisionId: string): Observable<ExplainDecisionResponseDto> {
    return this.api.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-team`, { decisionId });
  }

  explainRoutingDecision(missionId: string, taskId: string): Observable<ExplainDecisionResponseDto> {
    return this.api.post<ExplainDecisionResponseDto>(`/missions/${missionId}/assistant/explain-routing`, { taskId });
  }
}
