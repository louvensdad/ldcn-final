import { apiClient } from "./client";

export interface DiscoveryMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type RequirementOrigin = "USER" | "USER_IMPORTED" | "AI_SUGGESTED" | "AI_REFINED" | "ARCHITECTURE_DERIVED";
export type RequirementStatus = "DRAFT" | "SUGGESTED" | "CONFIRMED" | "REJECTED" | "SUPERSEDED";

/** Fase 8 da governança do PromptMaster: identidade própria por requirement, proveniência real. */
export interface RequirementDto {
  id: string;
  section: string;
  content: string;
  origin: RequirementOrigin;
  confidence: number | null;
  status: RequirementStatus;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
  parentRequirementId: string | null;
  evidence: string | null;
  reasoningSummary: string | null;
  promptMasterId: string | null;
}

export interface PromptMasterDto {
  id: string;
  version: number;
  vision: string;
  objective: string;
  targetAudience: string;
  users: RequirementDto[];
  features: RequirementDto[];
  businessRules: RequirementDto[];
  flows: RequirementDto[];
  data: RequirementDto[];
  integrations: RequirementDto[];
  security: RequirementDto[];
  privacy: RequirementDto[];
  nonFunctional: RequirementDto[];
  acceptanceCriteria: RequirementDto[];
  outOfScope: RequirementDto[];
  fullMarkdown: string;
  status: "DRAFT" | "PENDING_REVIEW" | "LOCKED" | "SUPERSEDED";
  createdAt: string;
  lockedAt: string | null;
  /** Fase 9 — o PROMPTMASTER_VALIDATION_GATE nomeado: a mesma checklist que o backend aplica antes de LOCKED. */
  gate: ValidationGateDto;
}

export type ValidationGateConditionCode =
  | "NO_UNRESOLVED_BLOCKERS"
  | "NO_PENDING_USER_DECISIONS"
  | "REQUIRED_SECTIONS_VALID"
  | "REVIEW_COUNCIL_COMPLETED";

export interface ValidationGateConditionDto {
  code: ValidationGateConditionCode;
  passed: boolean;
  failedReviewers?: string[];
}

export interface ValidationGateDto {
  promptMasterId: string;
  passed: boolean;
  conditions: ValidationGateConditionDto[];
}

export type DiscoveryStatus =
  | "WAITING_FOR_USER"
  | "FEATURE_REVIEW"
  | "PROMPTMASTER_READY"
  | "PROMPTMASTER_LOCKED"
  | "HANDED_OFF";

export interface ClassifiedItemDto {
  value: string;
  classification: "EXPLICIT" | "INFERRED";
}

export interface PromptMasterHistoryEntryDto {
  id: string;
  version: number;
  status: "DRAFT" | "PENDING_REVIEW" | "LOCKED" | "SUPERSEDED";
  createdBy: string;
  createdAt: string;
  lockedAt: string | null;
}

export type ReviewFindingSeverity = "INFO" | "ADVISORY" | "WARNING" | "BLOCKER";

/** MISSÃO "Auto-Governança por IA" seção 3 — a única classificação de decisão do sistema
 * inteiro, calculada pela PromptMasterDecisionPolicy no backend. Nunca reimplementar aqui: só
 * AUTO_FIX/DISCLOSE/CONFIRMATION → não bloqueia; USER_DECISION_REQUIRED/BLOCKED → bloqueia. */
export type DecisionPolicyOutcome = "AUTO" | "AUTO_WITH_DISCLOSURE" | "USER_CONFIRMATION" | "USER_DECISION_REQUIRED" | "BLOCKED";

/** Fase 6 — contrato único que todo reviewer produz; nunca texto livre controlando o fluxo. */
export interface ReviewFindingDto {
  id: string;
  reviewerKey: string;
  code: string;
  severity: ReviewFindingSeverity;
  section: string | null;
  requirementIds: string[];
  finding: string;
  recommendedResolutions: string[];
  requiresUserDecision: boolean;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  decisionOutcome: DecisionPolicyOutcome;
}

export interface DiscoveryConversationDto {
  missionId: string;
  status: DiscoveryStatus;
  rawUserIdea: string;
  interpretedIntent: string | null;
  domain: string | null;
  goal: string | null;
  /** Fase 4: só EXPLICIT é uma decisão confirmada do usuário — INFERRED é sempre hipótese. */
  targetUsers: ClassifiedItemDto[];
  knownRequirements: ClassifiedItemDto[];
  unknowns: string[];
  confidence: number;
  currentQuestion: { text: string; options: string[] } | null;
  turnCount: number;
  messages: DiscoveryMessageDto[];
  /** Todos os requirements da missão (todas as seções) — filtre por `section` quando precisar de um subconjunto. */
  requirements: RequirementDto[];
  promptMaster: PromptMasterDto | null;
  promptMasterHistory: PromptMasterHistoryEntryDto[];
  reviewFindings: ReviewFindingDto[];
  reviewerExecutions: ReviewerExecutionDto[];
  reviewStatus: "PENDING" | "REVIEW_COMPLETE" | "REVIEW_COMPLETE_DEGRADED" | "REVIEW_PARTIALLY_COMPLETED";
}

export type ReviewerCriticality = "CRITICAL" | "HIGH" | "LOW";

/** Fase 28 — telemetria real por reviewer: nunca chain-of-thought, só o que é auditável.
 * MISSÃO "Auto-Governança por IA" seção 8: estados reais, nunca um binário que esconde
 * "quase deu certo" (fallback) ou "não era crítico" (degraded). */
export interface ReviewerExecutionDto {
  reviewerKey: string;
  status: "PASSED" | "PASSED_WITH_FALLBACK" | "DEGRADED" | "FAILED_BLOCKING";
  criticality: ReviewerCriticality;
  provider: string | null;
  model: string | null;
  findingCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  attemptCount: number;
  fallbackUsed: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface StartMissionAcceptedDto {
  operationId: string;
  missionId: string;
  status: "SUCCEEDED" | "FAILED";
}

export interface DiscoveryAdvancedInput {
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: string[];
  constraints?: string[];
}

export type CopilotChangeAction = "ADD" | "EDIT" | "REMOVE";

/** Fase 5 — o Copilot nunca aplica direto: isto é uma proposta, sempre revisada antes de entrar no documento. */
export interface CopilotChangeDto {
  action: CopilotChangeAction;
  section: string;
  targetRequirementId: string | null;
  beforeContent: string | null;
  afterContent: string | null;
  reason: string;
}

export interface CopilotProposalDto {
  summary: string;
  changes: CopilotChangeDto[];
}

export const discoveryClient = {
  start(missionId: string, rawUserIdea: string, advancedInput?: DiscoveryAdvancedInput): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/start`, { rawUserIdea, advancedInput });
  },
  get(missionId: string): Promise<DiscoveryConversationDto | null> {
    return apiClient.get<DiscoveryConversationDto | null>(`/missions/${missionId}/discovery`);
  },
  startFromImport(missionId: string, specText: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/import`, { specText });
  },
  respond(missionId: string, answer: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/respond`, { answer });
  },
  decideRequirement(missionId: string, requirementId: string, decision: "CONFIRMED" | "REJECTED"): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/requirements/${requirementId}/decision`, { decision });
  },
  generatePromptMaster(missionId: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster`, {});
  },
  approvePromptMaster(missionId: string): Promise<StartMissionAcceptedDto> {
    return apiClient.post<StartMissionAcceptedDto>(`/missions/${missionId}/discovery/promptmaster/approve`, {});
  },
  getValidationGate(missionId: string): Promise<ValidationGateDto> {
    return apiClient.get<ValidationGateDto>(`/missions/${missionId}/discovery/promptmaster/gate`);
  },
  createChangeRequest(missionId: string, reason: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster/change-request`, { reason });
  },
  proposeCopilotChange(missionId: string, message: string): Promise<CopilotProposalDto> {
    return apiClient.post<CopilotProposalDto>(`/missions/${missionId}/discovery/promptmaster/copilot`, { message });
  },
  applyCopilotChanges(missionId: string, changes: (CopilotChangeDto & { accepted: boolean })[]): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster/copilot/apply`, { changes });
  },
  retryReviewer(missionId: string, reviewerKey: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster/review/${reviewerKey}/retry`, {});
  },
  resolveFinding(missionId: string, findingId: string, resolutionNote?: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster/findings/${findingId}/resolve`, { resolutionNote });
  },
  decideFinding(missionId: string, findingId: string, chosenOption: string): Promise<DiscoveryConversationDto> {
    return apiClient.post<DiscoveryConversationDto>(`/missions/${missionId}/discovery/promptmaster/findings/${findingId}/decide`, { chosenOption });
  },
};
