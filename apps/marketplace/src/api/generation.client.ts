import { API_BASE_URL } from "./config";
import { getStoredApiKey } from "../auth/AuthContext";
import { apiClient } from "./client";

/** Mirrors apps/api/src/generation-engine/generation-engine.service.ts (MissionGenerationRunDto). */
export interface MissionGenerationRunDto {
  id: string;
  missionId: string;
  status: string;
  targetKind: string;
  pluginId: string;
  scaffold: { fileCount: number; requirementIds: string[]; skippedRequirementIds: string[] } | null;
  build: { command: string; exitCode: number | null; durationMs: number; logsExcerpt: string } | null;
  test: { command: string; exitCode: number | null; total: number; passed: number; failed: number; durationMs: number; logsExcerpt: string } | null;
  runtime: { port: number; healthCheckOk: boolean; durationMs: number; logsExcerpt: string } | null;
  downloadReady: boolean;
  /** MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility" — nunca true só porque
   * build/test/runtime passaram. */
  deliveryEligible: boolean;
  requirementCoverage: RequirementCoverageItemDto[] | null;
  /** MISSÃO "Security Gate real antes da entrega" — npm audit real + secret scan real + Security
   * Reviewer real sobre código autoral de agente. */
  securityPassed: boolean;
  security: SecurityReportDto | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementCoverageItemDto {
  requirementId: string;
  section: string;
  content: string;
  status: "EVIDENCED" | "OUT_OF_SCOPE_THIS_VERSION" | "FAILED";
}

export interface SecurityReportDto {
  npmAudit: { ran: boolean; critical: number; high: number; moderate: number; low: number };
  secretsFound: number;
  secrets: { file: string; pattern: string; line: number }[];
  reviewerRan: boolean;
  reviewerErrorCode: string | null;
  reviewerFindings: { code: string; severity: string; file: string; finding: string }[];
}

export interface GeneratedArtifactDto {
  id: string;
  path: string;
  ownerAgent: string;
  hash: string;
  sizeBytes: number;
  validationStatus: string;
}

/** Mirrors apps/api's GenerationJob (Prisma row shape — the raw wire response of GET .../jobs). */
export interface GenerationJobDto {
  id: string;
  requirementId: string;
  requirementText: string;
  targetResource: string;
  targetFile: string;
  agentKey: string;
  status: "PENDING" | "IMPLEMENTED" | "FAILED";
  analysisText: string | null;
  planText: string | null;
  implementationSummary: string | null;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  /** MISSÃO "Repair loop real quando um Job falha" — attemptCount > 1 = precisou de reparo real.
   * firstAttemptErrorCode nunca é apagado mesmo quando o reparo dá certo. */
  attemptCount: number;
  firstAttemptErrorCode: string | null;
  /** MISSÃO "Independent Reviewer agent por Job" — null = reviewer não rodou de verdade (nunca
   * confundido com aprovação real). */
  reviewerApproved: boolean | null;
  reviewerFinding: string | null;
  createdAt: string;
}

const TERMINAL_STATUSES = new Set(["READY", "BUILD_FAILED", "TEST_FAILED", "RUNTIME_FAILED", "TARGET_NOT_SUPPORTED"]);

export function isGenerationTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export const generationClient = {
  start(missionId: string): Promise<MissionGenerationRunDto> {
    return apiClient.post<MissionGenerationRunDto>(`/missions/${missionId}/generation/start`, {});
  },
  getStatus(missionId: string): Promise<MissionGenerationRunDto> {
    return apiClient.get<MissionGenerationRunDto>(`/missions/${missionId}/generation`);
  },
  getArtifacts(missionId: string): Promise<GeneratedArtifactDto[]> {
    return apiClient.get<GeneratedArtifactDto[]>(`/missions/${missionId}/generation/artifacts`);
  },
  getJobs(missionId: string): Promise<GenerationJobDto[]> {
    return apiClient.get<GenerationJobDto[]>(`/missions/${missionId}/generation/jobs`);
  },
  startPreview(missionId: string): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(`/missions/${missionId}/generation/preview/start`, {});
  },
  stopPreview(missionId: string): Promise<{ stopped: boolean }> {
    return apiClient.post<{ stopped: boolean }>(`/missions/${missionId}/generation/preview/stop`, {});
  },
  /** Binary download needs a real auth header, so it can't be a plain `<a href>` navigation (the
   * browser wouldn't send x-api-key) — fetch as a Blob and let the caller trigger the save. */
  async downloadZip(missionId: string): Promise<Blob> {
    const apiKey = getStoredApiKey();
    const headers = new Headers();
    if (apiKey) headers.set("x-api-key", apiKey);
    const response = await fetch(`${API_BASE_URL}/missions/${missionId}/generation/download`, { headers });
    if (!response.ok) throw new Error(`DOWNLOAD_FAILED_${response.status}`);
    return response.blob();
  },
};
