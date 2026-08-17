import { apiClient } from "./client";

export interface StartMissionRequest {
  rawUserIdea: string;
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: string[];
  constraints?: string[];
}

/** apps/api GeneratorController#start response. */
export interface StartMissionAcceptedDto {
  operationId: string;
  missionId: string;
  status: "SUCCEEDED" | "FAILED";
}

export interface LearningSignalsDto {
  sampleCount: number;
  successRate: number;
  repairRate: number;
}

export interface GeneratorEventDto {
  id: string;
  eventType: string;
  version: number;
  createdAt: number;
  payload: Record<string, string | number | boolean | null>;
}

export const generatorClient = {
  start(missionId: string, request: StartMissionRequest): Promise<StartMissionAcceptedDto> {
    return apiClient.post<StartMissionAcceptedDto>(`/missions/${missionId}/intelligent-generator/start`, request);
  },
  learning(missionId: string): Promise<LearningSignalsDto> {
    return apiClient.get<LearningSignalsDto>(`/missions/${missionId}/intelligent-generator/learning`);
  },
  events(missionId: string): Promise<GeneratorEventDto[]> {
    return apiClient.get<GeneratorEventDto[]>(`/missions/${missionId}/intelligent-generator/events`);
  },
};
