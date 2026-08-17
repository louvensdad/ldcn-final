/**
 * CORE-003 — PromptMaster runtime (COMPILAÇÃO DE CONTEXTO COGNITIVO).
 *
 * Nome deliberadamente igual ao termo "PromptMaster" já usado em `review/` e `discovery/` —
 * mas é um conceito DIFERENTE: `PromptMasterVersion` (schema.prisma) é o documento de requisitos
 * do Discovery (vision/objective/fullMarkdown); `PromptMasterEditingService` edita esse documento.
 * Nenhum dos dois é tocado por este módulo. Aqui, "PromptMaster" é o serviço que compila
 * AgentDefVersion + Job + contexto em um CompiledPrompt auditável — nunca chama LLM, nunca edita
 * documento nenhum.
 */

export type PromptPurpose = 'ANALYSIS' | 'PLANNING' | 'IMPLEMENTATION' | 'SELF_CHECK' | 'REPAIR' | 'REVIEW' | 'SOLUTION_PLANNING' | 'ARCHITECTURE_PROPOSAL' | 'ARCHITECTURE_REVIEW' | 'ARCHITECTURE_ARBITRATION' | 'IMPLEMENTATION_PLANNING';

export type TrustZone = 'SYSTEM_RULES' | 'TRUSTED_PLATFORM_CONTEXT' | 'UNTRUSTED_PROJECT_CONTEXT';

/** Doc CORE-003 §14: "se algum conceito ainda não existe, representar como ausência explícita." */
export interface Unavailable {
  available: false;
  reason: string;
}

export interface MissionIdentity {
  available: true;
  missionId: string;
  purpose: string | null;
  domain: string | null;
  goal: string | null;
}

export interface ApprovedSolutionRef {
  available: true;
  approvedSolutionId: string;
  architectureCompositionId: string;
  status: string;
}

export interface JobContext {
  id: string;
  requirementId: string;
  requirementText: string;
  targetResource: string;
  targetFile: string;
  status: string;
  attemptCount: number;
  firstAttemptErrorCode: string | null;
}

export interface JobScopeContext {
  available: true;
  targetFile: string;
  targetResource: string;
  /** CORE-007 — mesmo scope canônico que o ScopeValidator aplica (doc §3/§18): quando um
   * `JobScope` persistido existe para o Job, estes campos vêm dele; senão (Jobs sem JobScope
   * persistido, ex.: fixtures antigas) caem para o mínimo inferível `[targetFile]` — nunca
   * `["**"]` como fallback silencioso. `scopeHash` é `null` só nesse caso derivado. */
  allowedPaths: string[];
  forbiddenPaths: string[];
  acceptanceCriteria: string[];
  scopeHash: string | null;
}

export interface RequirementContext {
  id: string;
  section: string;
  content: string;
  status: string;
}

export interface ArtifactContext {
  id: string;
  path: string;
  target: string;
  hash: string;
  version: number;
  symbols: unknown[];
}

/** CORE-010: evidence for one exact isolated candidate. Source exists only in memory while the
 * prompt is compiled/sent; PromptSnapshot persists only the refs and hashes below. */
export interface CandidateReviewContext {
  workspaceSessionId: string;
  candidateFingerprint: string;
  manifestHash: string;
  changeSetHash: string;
  files: { path: string; content: string; contentHash: string }[];
  build: { status: 'PASS'; commandProfile: string; exitCode: number | null; stdoutHash: string | null; stderrHash: string | null };
  test: { status: 'PASS'; commandProfile: string; exitCode: number | null; passedCount: number | null; failedCount: number | null; skippedCount: number | null; stdoutHash: string | null; stderrHash: string | null };
}

/**
 * Contexto mínimo suficiente para UM Job + UM AgentDefVersion (doc CORE-003 §3/§4) — nunca a
 * Mission inteira. Cada slot ausente é uma `Unavailable` explícita, nunca omitido silenciosamente.
 */
export interface LoadedContext {
  missionId: string;
  jobId: string;
  mission: MissionIdentity | Unavailable;
  requirements: RequirementContext[];
  approvedSolution: ApprovedSolutionRef | Unavailable;
  architecture: ApprovedSolutionRef | Unavailable;
  job: JobContext;
  jobScope: JobScopeContext | Unavailable;
  artifacts: ArtifactContext[];
  /** Nenhum Contract registry existe hoje (auditoria CORE-003 §L) — sempre Unavailable nesta CORE. */
  contracts: Unavailable;
  /** Grafo de dependências ainda não existe (fora de escopo desta CORE) — sempre vazio. */
  dependencyEvidence: unknown[];
  /** PolicyPack catalog ainda não existe (fora de escopo desta CORE) — sempre vazio. */
  policies: string[];
}

export interface ContextLoadInput {
  missionId: string;
  jobId: string;
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
}

export interface PreviousStepSummary {
  purpose: PromptPurpose;
  summary: string;
}

export interface ContextBudget {
  maxEstimatedTokens: number;
  sectionBudgets?: Partial<Record<PromptSectionName, number>>;
}

export type PromptSectionName =
  | 'IDENTITY'
  | 'BOUNDARIES'
  | 'OUTPUT_CONTRACT'
  | 'MISSION_CONTEXT'
  | 'JOB'
  | 'JOB_SCOPE'
  | 'CODEBASE_CONTEXT'
  | 'KNOWLEDGE'
  | 'PREVIOUS_STEPS'
  | 'TASK';

export interface CompiledPromptSection {
  name: PromptSectionName;
  trustZone: TrustZone;
  text: string;
  truncated: boolean;
}

export interface CompiledPromptResult {
  sections: CompiledPromptSection[];
  renderedText: string;
  /** CORE-004 — split determinístico por trust zone para chamar o LlmClient existente
   * ({system, user}): system = seções SYSTEM_RULES (IDENTITY/BOUNDARIES/OUTPUT_CONTRACT/TASK,
   * na ordem canônica); user = todas as demais, incluindo os blocos UNTRUSTED_PROJECT_CONTEXT
   * delimitados inline. Aditivo — não afeta contextHash/compiledPromptHash (calculados sobre
   * renderedText, que continua igual). */
  systemText: string;
  userText: string;
  contextHash: string;
  compiledPromptHash: string;
  estimatedTokens: number;
  refs: {
    agentDefinitionKey: string;
    agentDefinitionVersion: number;
    promptTemplateKey: string;
    promptTemplateVersion: string;
    jobId: string;
    requirementIds: string[];
    artifactIds: string[];
    capabilityKeys: string[];
    knowledgeRefs: string[];
    contractRefs: string[];
  };
  outputSchemaKey: string;
  purpose: PromptPurpose;
}
