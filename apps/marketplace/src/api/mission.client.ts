import { apiClient } from "./client";
import type { OperationDto } from "./operation.client";

/** MissionOverviewReadModel wire shape, from GET /missions/:id/overview. Mirrors apps/web's MissionOverviewDto. */
export interface MissionOverviewDto {
  missionId: string;
  generatorState?: string;
  currentOperation: OperationDto | null;
  intentSummary: { rawUserIdea: string; problemStatement: string; confidence: number; status: string };
  requirementsSummary: { itemCount: number; status: string };
  topologySummary: { requiredTargets: string[]; status: string };
  solutionSummary: { selectedStackCount: number; deliveryTargetCount: number; status: string };
  architectureSummary: { proposalCount: number; conflictCount: number; status: string };
  /** MISSÃO "Arquitetura não pode seguir automaticamente para Entrega" — null = review ainda não
   * foi iniciada; senão "PENDING" | "APPROVED" | "REWORK_REQUIRED" | "BLOCKED". */
  architectureReviewStatus: string | null;
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

/** apps/api MissionsController#list response. */
export interface MissionSummaryDto {
  missionId: string;
  generatorState?: string;
  rawUserIdea: string;
  nextAction: string;
  blockers: string[];
  updatedAt: string;
}

export const missionClient = {
  list(): Promise<MissionSummaryDto[]> {
    return apiClient.get<MissionSummaryDto[]>("/missions");
  },
  getOverview(missionId: string): Promise<MissionOverviewDto> {
    return apiClient.get<MissionOverviewDto>(`/missions/${missionId}/overview`);
  },
};
