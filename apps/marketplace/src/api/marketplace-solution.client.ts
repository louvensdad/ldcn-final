import { apiClient } from "./client";

export type SolutionStatus = "DRAFT" | "VALIDATING" | "BETA" | "VERIFIED" | "DEPRECATED" | "REJECTED";
export type SolutionVersionStatus = "DRAFT" | "VERIFIED" | "REJECTED";

export interface MarketplaceManifestTarget {
  enabled: boolean;
  pluginId: string | null;
}

export interface MarketplaceCustomizationPolicy {
  branding: boolean;
  content: boolean;
  modules: boolean;
  businessRules: boolean;
  integrations: boolean;
  databaseChange: boolean;
  backendStackChange: boolean;
  frontendStackChange: boolean;
}

export interface MarketplaceManifest {
  solutionId: string;
  version: string;
  status: "DRAFT" | "VERIFIED" | "REJECTED";
  targets: {
    backend: MarketplaceManifestTarget;
    frontend: MarketplaceManifestTarget;
    mobile: MarketplaceManifestTarget;
  };
  database: { pluginId: string } | null;
  capabilities: string[];
  optionalCapabilities: string[];
  removableCapabilities: string[];
  customizationPolicy: MarketplaceCustomizationPolicy;
}

/** Fase C — MARKETPLACE_SOLUTION_VERIFICATION_GATE: nunca mostra "PASSED" para build/test/
 * runtime/preview que este sistema não tem de verdade — cada check carrega seu motivo real. */
export interface VerificationCheckDto {
  code: string;
  passed: boolean;
  detail: string;
}

export interface VerificationGateResultDto {
  status: "VERIFIED" | "REJECTED";
  checks: VerificationCheckDto[];
  evaluatedAt: string;
}

export interface MarketplaceSolutionDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  publisherId: string;
  status: SolutionStatus;
  visibility: string;
  category: string;
  industry: string | null;
  tags: string[];
  pricingModel: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface MarketplaceSolutionVersionDto {
  id: string;
  solutionId: string;
  version: number;
  referenceMissionId: string;
  referencePromptMasterVersionId: string;
  manifest: MarketplaceManifest;
  stackSnapshot: { deliveryTargetKind: string; stackKey: string; stackName: string; rationale: string }[];
  validationSnapshot: VerificationGateResultDto | null;
  pricingSnapshot: { basePrice: number };
  status: SolutionVersionStatus;
  releaseNotes: string | null;
  checksum: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface CreateSolutionInput {
  slug: string;
  name: string;
  description: string;
  publisherId: string;
  category: string;
  industry?: string;
  tags?: string[];
  pricingModel?: string;
}

export interface CreateVersionInput {
  referenceMissionId: string;
  releaseNotes?: string;
  capabilities?: string[];
  optionalCapabilities?: string[];
  removableCapabilities?: string[];
  customizationPolicy?: Partial<MarketplaceCustomizationPolicy>;
  basePrice: number;
}

export type ChangeType = "COSMETIC" | "CONTENT" | "CONFIGURATION" | "MODULE" | "BUSINESS_RULE" | "INTEGRATION" | "DATA_MODEL" | "ARCHITECTURAL";
export type ArchitectureImpact = "PATCH" | "REVIEW_REQUIRED" | "NEW_ARCHITECTURE_REQUIRED";
export type ComplexityClass = "LOW" | "MEDIUM" | "HIGH";

export type ReviewFindingSeverity = "INFO" | "ADVISORY" | "WARNING" | "BLOCKER";
export type DecisionPolicyOutcome = "AUTO" | "AUTO_WITH_DISCLOSURE" | "USER_CONFIRMATION" | "USER_DECISION_REQUIRED" | "BLOCKED";

/** Fase 6/8 do audit "Completar o fluxo de compra/personalização" — mesmo contrato do
 * ReviewFindingDto do Discovery (apps/marketplace/src/api/discovery.client.ts), nunca
 * reimplementado: o Review Council e a DecisionPolicy são os mesmos serviços por baixo. */
export interface MarketplaceReviewFindingDto {
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

export type ReviewerCriticality = "CRITICAL" | "HIGH" | "LOW";

export interface MarketplaceReviewerExecutionDto {
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

export type MarketplaceReviewGateConditionCode = "NO_UNRESOLVED_BLOCKERS" | "NO_PENDING_USER_DECISIONS" | "REVIEW_COUNCIL_COMPLETED";

export interface MarketplaceReviewGateDto {
  promptMasterId: string;
  passed: boolean;
  conditions: { code: MarketplaceReviewGateConditionCode; passed: boolean; failedReviewers?: string[] }[];
}

/** Fase 2 — a "MarketplaceReviewSession": uma view computada (nunca uma entidade persistida à
 * parte) sobre o plano + achados + execuções do Review Council para o PromptMaster derivado. */
export interface MarketplaceReviewSessionDto {
  planId: string;
  promptMasterId: string;
  status: "REVIEWING" | "WAITING_USER" | "READY" | "REVIEW_LOOP_EXHAUSTED";
  gate: MarketplaceReviewGateDto;
  findings: MarketplaceReviewFindingDto[];
  reviewerExecutions: MarketplaceReviewerExecutionDto[];
  reviewStatus: "PENDING" | "REVIEW_COMPLETE" | "REVIEW_COMPLETE_DEGRADED" | "REVIEW_PARTIALLY_COMPLETED";
  autoResolvedCount: number;
  userDecisionsMadeCount: number;
  reviewAttemptCount: number;
  maxReviewAttempts: number;
}

export interface CustomizationPlanDto {
  id: string;
  solutionId: string;
  solutionVersionId: string;
  missionId: string;
  asIs: boolean;
  businessContext: string;
  keep: string[];
  remove: { targetContent: string; type: ChangeType }[];
  modify: { targetContent: string; newContent: string; type: ChangeType }[];
  add: { section: string; content: string; type: ChangeType }[];
  droppedForPolicy: { item: string; type: ChangeType }[];
  architecturalChangesDetected: string[];
  missingInformation: string[];
  assumptions: string[];
  complexity: ComplexityClass;
  architectureImpact: ArchitectureImpact;
  requiresArchitectureReview: boolean;
  requiresUserDecision: boolean;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  createdAt: string;
  approvedAt: string | null;
  review: MarketplaceReviewSessionDto | null;
}

export interface PricingQuoteDto {
  id: string;
  customizationPlanId: string | null;
  solutionId: string;
  solutionVersionId: string;
  basePrice: number;
  customizationPrice: number;
  integrationPrice: number;
  estimatedAiCost: number;
  discount: number;
  total: number;
  currency: string;
  calculationVersion: string;
  validUntil: string;
  createdAt: string;
}

/** MISSÃO "Targeted Generation no Marketplace" — nunca "gerou tudo de novo" opaco: quando a
 * customização não exige recompor arquitetura/equipe, a mission derivada reaproveita as decisões
 * já governadas da solução de referência (ver relatório — auditoria confirmou que este sistema não
 * tem uma camada de artifacts/código real; o "delta" real são as decisões de planejamento). */
export interface MarketplacePurchaseGenerationDto {
  operationId: string;
  status: string;
  generationMode: "TARGETED" | "FULL" | null;
  impactScore: number | null;
  reusedRequirements: number | null;
  totalRequirements: number | null;
}

export interface MarketplacePurchaseDto {
  id: string;
  solutionId: string;
  solutionVersionId: string;
  customizationPlanId: string | null;
  pricingQuoteId: string;
  derivedProjectId: string | null;
  derivedMissionId: string | null;
  status: string;
  purchasedBy: string;
  createdAt: string;
  generation: MarketplacePurchaseGenerationDto;
}

export type MarketplaceChangeType = "COSMETIC" | "CONTENT" | "CONFIGURATION" | "MODULE" | "BUSINESS_RULE" | "INTEGRATION" | "DATA_MODEL" | "ARCHITECTURAL";

export interface MarketplaceGenerationScopeDto {
  id: string;
  customizationPlanId: string;
  solutionId: string;
  referenceMissionId: string;
  derivedMissionId: string;
  derivedProjectId: string | null;
  changeClasses: MarketplaceChangeType[];
  affectedSections: string[];
  requiresStackReselection: boolean;
  requiresArchitectureRecompute: boolean;
  requiresTeamRecompute: boolean;
  generationMode: "TARGETED" | "FULL";
  actualReuse: { reuseStackSelection: boolean; reuseArchitecture: boolean; reuseTeam: boolean } | null;
  escalations: { stage: string; reason: string }[];
  impactScore: number;
  totalRequirements: number;
  reusedRequirements: number;
  reason: string;
  createdAt: string;
  completedAt: string | null;
}

export const marketplaceSolutionClient = {
  list(status?: SolutionStatus): Promise<MarketplaceSolutionDto[]> {
    return apiClient.get<MarketplaceSolutionDto[]>("/marketplace/solutions", status ? { status } : undefined);
  },
  getBySlug(slug: string): Promise<{ solution: MarketplaceSolutionDto; currentVersion: MarketplaceSolutionVersionDto | null }> {
    return apiClient.get(`/marketplace/solutions/${slug}`);
  },
  create(input: CreateSolutionInput): Promise<MarketplaceSolutionDto> {
    return apiClient.post("/marketplace/solutions", input);
  },
  listVersions(solutionId: string): Promise<MarketplaceSolutionVersionDto[]> {
    return apiClient.get(`/marketplace/solutions/${solutionId}/versions`);
  },
  createVersion(solutionId: string, input: CreateVersionInput): Promise<MarketplaceSolutionVersionDto> {
    return apiClient.post(`/marketplace/solutions/${solutionId}/versions`, input);
  },
  getVersion(versionId: string): Promise<MarketplaceSolutionVersionDto> {
    return apiClient.get(`/marketplace/solutions/versions/${versionId}`);
  },
  verify(versionId: string): Promise<VerificationGateResultDto> {
    return apiClient.post(`/marketplace/solutions/versions/${versionId}/verify`, {});
  },
  publish(versionId: string): Promise<MarketplaceSolutionDto> {
    return apiClient.post(`/marketplace/solutions/versions/${versionId}/publish`, {});
  },
  createCustomizationPlan(slug: string, input: { rawBusinessDescription?: string; asIs?: boolean }): Promise<CustomizationPlanDto> {
    return apiClient.post(`/marketplace/solutions/${slug}/customization-plans`, input);
  },
  getPlan(planId: string): Promise<CustomizationPlanDto> {
    return apiClient.get(`/marketplace/customization-plans/${planId}`);
  },
  approvePlan(planId: string): Promise<CustomizationPlanDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/approve`, {});
  },
  quotePlan(planId: string): Promise<PricingQuoteDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/quote`, {});
  },
  purchase(planId: string, pricingQuoteId: string): Promise<MarketplacePurchaseDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/purchase`, { pricingQuoteId });
  },
  // Fase 8 do audit "Completar o fluxo de compra/personalização" — Marketplace Finding API.
  getReviewSession(planId: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.get(`/marketplace/customization-plans/${planId}/review`);
  },
  resolveFinding(planId: string, findingId: string, resolutionNote?: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/findings/${findingId}/resolve`, { resolutionNote });
  },
  decideFinding(planId: string, findingId: string, chosenOption: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/findings/${findingId}/decide`, { chosenOption });
  },
  delegateToAi(planId: string, findingId: string, instruction?: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/findings/${findingId}/delegate-to-ai`, { instruction });
  },
  retryReviewer(planId: string, reviewerKey: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/review/${reviewerKey}/retry`, {});
  },
  resumeReview(planId: string): Promise<MarketplaceReviewSessionDto> {
    return apiClient.post(`/marketplace/customization-plans/${planId}/review/resume`, {});
  },
  getGenerationScope(planId: string): Promise<MarketplaceGenerationScopeDto | null> {
    return apiClient.get(`/marketplace/customization-plans/${planId}/generation-scope`);
  },
};
