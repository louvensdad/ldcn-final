import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LLM_CLIENT, LlmClient, LlmCompletionResult } from '../assistant/deepseek-client';
import { PlannedJob } from './job-planner';
import { PrismaService } from '../persistence/prisma.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { assertCognitiveInvariant } from '../ledger/cognitive-invariant';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { CandidateReviewContext, PreviousStepSummary, PromptPurpose } from '../promptmaster/types';
import { canonicalHash } from './canonical-hash';
import {
  AnalysisResultV1,
  ChangeSetProposalV1,
  ImplementationPlanV1,
  SelfCheckResultV1,
  CodeReviewResultV1,
  validateAnalysisResult,
  validateChangeSetProposal,
  validateImplementationPlan,
  validateSelfCheckResult,
  validateCodeReviewResult,
} from './cognitive-schemas';

const REVIEWER_TIMEOUT_MS = 45_000;
/** MISSÃO "Repair loop real quando um Job falha" — limite real de tentativas: 1 tentativa
 * original + 1 reparo, nunca infinito. Mesmo espírito do maxAttempts do ReviewCouncilService
 * (retry real com contexto do erro, não um retry cego repetindo a mesma chamada). */
const MAX_ATTEMPTS = 2;

export interface AgentExecutionResult {
  status: 'IMPLEMENTED' | 'FAILED';
  analysisText: string | null;
  planText: string | null;
  implementationSummary: string | null;
  updatedFileContent: string | null;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  errorCode: string | null;
}

export interface AgentExecutionWithRepairResult extends AgentExecutionResult {
  agentExecutionId: string;
  attemptCount: number;
  /** Nunca escondido: se um reparo foi precisou e deu certo na 2ª tentativa, o motivo real da
   * primeira falha continua visível — "deu certo" não apaga "precisou de reparo". */
  firstAttemptErrorCode: string | null;
}

interface RepairContext {
  previousErrorCode: string;
  attemptNumber: number;
}

/** SLICE C1: contexto mínimo para ligar a tentativa a uma Mission/Run reais no ledger. */
export interface AgentExecutionContext {
  missionId: string;
  generationRunId?: string;
  generationJobId?: string;
}

/** CORE-004: contexto comum repassado a cada fase cognitiva da mesma AgentExecution. */
export interface PhaseContext {
  missionId: string;
  jobId: string;
  agentExecutionId: string;
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
}

export interface StructuredJobResult {
  agentExecutionId: string;
  status: 'SUCCEEDED';
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
  analysis: AnalysisResultV1;
  plan: ImplementationPlanV1;
  changeset: ChangeSetProposalV1;
  selfCheck: SelfCheckResultV1;
  confidenceScore: number;
}

export class ReviewExecutionFailedError extends Error {
  constructor(public readonly agentExecutionId: string, errorCode: string) {
    super(errorCode);
    this.name = 'ReviewExecutionFailedError';
  }
}

const ERROR_EXPLANATIONS: Record<string, string> = {
  AGENT_SCOPE_VIOLATION: 'você modificou, removeu ou renomeou um método/propriedade/interface que já existia — isso quebra o controller, que não é regenerado.',
  AGENT_SUSPICIOUSLY_SHORT_OUTPUT: 'o conteúdo devolvido estava muito mais curto que o arquivo original — parece truncado ou incompleto.',
  AGENT_MALFORMED_RESPONSE: 'a resposta não seguiu o formato JSON exigido, ou "updatedFileContent" veio vazio.',
  AGENT_LLM_UNAVAILABLE: 'uma falha de rede/infraestrutura impediu a resposta anterior — sem relação com o conteúdo.',
  AGENT_TIMEOUT: 'a resposta anterior demorou demais e expirou — sem relação com o conteúdo.',
};

interface AgentJsonResponse {
  analysis: string;
  plan: string;
  implementationSummary: string;
  updatedFileContent: string;
}

const OUTPUT_SCHEMA = `Responda SOMENTE com um objeto JSON válido, sem markdown, exatamente neste formato:
{"analysis": string, "plan": string, "implementationSummary": string, "updatedFileContent": string}

"analysis": o que você entendeu da regra de negócio e do arquivo atual (2-4 frases).
"plan": o que você vai adicionar e como (2-4 frases).
"implementationSummary": resumo de uma frase do que foi implementado.
"updatedFileContent": o conteúdo COMPLETO e final do arquivo TypeScript, pronto para substituir o arquivo original — nunca um trecho, nunca um diff.`;

/**
 * MISSÃO "Job Planner + execução por agente cognitivo real" — o ciclo real ANALYZE→PLAN→PROPOSE→
 * IMPLEMENT de um agente cognitivo (nunca um template): recebe o Job, o Requirement de origem e o
 * arquivo real já escaffoldado, e devolve um ChangeSet candidato (nunca aplicado sem validação
 * estrutural). "Agente pensa com LLM. Ferramenta mede. Validator verifica. Gate decide." — a
 * validação aqui é a "Ferramenta"/"Validator": puramente mecânica, nunca outra chamada de IA.
 */
@Injectable()
export class AgentExecutionService {
  private reviewerTimeoutMs = REVIEWER_TIMEOUT_MS;

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly prisma: PrismaService,
    private readonly ledger: LlmInvocationLedgerService,
    private readonly catalog: AgentCatalogService,
    private readonly promptMaster: PromptMasterService
  ) {}

  /** MISSÃO "Repair loop real quando um Job falha": tenta `implement()` até MAX_ATTEMPTS vezes —
   * cada tentativa além da primeira é um reparo real, com o motivo exato da falha anterior
   * incluído no prompt (nunca um retry cego repetindo a mesma chamada sem contexto novo).
   *
   * SLICE C1: cada tentativa é uma AgentExecution real e independente (reason INITIAL na 1ª,
   * STRUCTURAL_REPAIR nas seguintes) — um repair de 2 tentativas produz 2 linhas de
   * AgentExecution e (se ambas chamaram o LLM) 2 LlmInvocationRecord, nunca 1 sobrescrevendo a
   * outra; os tokens da 1ª tentativa nunca se perdem mesmo quando a 2ª tem sucesso. */
  async implementWithRepair(job: PlannedJob, currentFileContent: string, ctx: AgentExecutionContext): Promise<AgentExecutionWithRepairResult> {
    let firstAttemptErrorCode: string | null = null;
    let result: AgentExecutionResult | null = null;
    let attemptCount = 0;
    let lastAgentExecutionId = '';
    const frozenDefinition = await this.catalog.getCurrentVersion(job.agentKey);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptCount = attempt;
      const repairContext = attempt > 1 && result?.errorCode ? { previousErrorCode: result.errorCode, attemptNumber: attempt } : undefined;

      const agentExecutionId = randomUUID();
      lastAgentExecutionId = agentExecutionId;
      const startedAt = new Date();
      await this.prisma.agentExecution.create({
        data: {
          id: agentExecutionId,
          missionId: ctx.missionId,
          generationRunId: ctx.generationRunId ?? null,
          generationJobId: ctx.generationJobId ?? null,
          agentKey: job.agentKey,
          agentDefinitionKey: frozenDefinition ? job.agentKey : null,
          agentDefinitionVersion: frozenDefinition?.version ?? null,
          mode: 'COGNITIVE',
          attempt,
          reason: attempt === 1 ? 'INITIAL' : 'STRUCTURAL_REPAIR',
          status: 'RUNNING',
          startedAt,
        },
      });

      result = await this.implement(job, currentFileContent, ctx.missionId, agentExecutionId, repairContext);

      const invocationCount = await this.ledger.countInvocations(agentExecutionId);
      assertCognitiveInvariant('COGNITIVE', invocationCount);

      const completedAt = new Date();
      await this.prisma.agentExecution.update({
        where: { id: agentExecutionId },
        data: {
          status: result.status === 'IMPLEMENTED' ? 'SUCCEEDED' : 'FAILED',
          completedAt,
          elapsedMs: completedAt.getTime() - startedAt.getTime(),
        },
      });

      if (attempt === 1 && result.status === 'FAILED') firstAttemptErrorCode = result.errorCode;
      if (result.status === 'IMPLEMENTED') break;
    }

    return { ...result!, agentExecutionId: lastAgentExecutionId, attemptCount, firstAttemptErrorCode };
  }

  // =====================================================================
  // CORE-004 — STRUCTURED COGNITIVE STEPS
  //
  // Evolução do mesmo AgentExecutionService (não um engine paralelo): implement()/
  // implementWithRepair() acima continuam exatamente como estavam (usados hoje por
  // GenerationEngineService) — runStructuredJob() é um NOVO caminho, ainda não chamado por
  // nenhum call site de produção (nenhum call site foi migrado nesta CORE, conforme escopo).
  // AgentExecution continua o envelope canônico da tentativa cognitiva; runStructuredJob só
  // ensina esse envelope a percorrer ANALYSIS → PLANNING → IMPLEMENTATION → SELF_CHECK via
  // PromptMaster (CORE-003) + AgentCatalogService (CORE-002) em vez do prompt inline legado.
  // =====================================================================

  /**
   * CORE-005 §8: extraído de runStructuredJob() para que o AgentRuntime (FSM) possa observar/
   * controlar cada fase individualmente sem duplicar a lógica de compilação/LLM/validação —
   * runStructuredJob() abaixo continua existindo como convenience wrapper (compatibilidade com
   * CORE-004/testes), agora implementado só como uma chamada sequencial destes mesmos métodos.
   */
  async beginStructuredExecution(input: {
    missionId: string;
    jobId: string;
    agentInstanceId?: string;
    /** CORE-005 §3: se o chamador (AgentRuntime) já congelou a versão no AgentInstance, este
     * método NUNCA consulta getCurrentVersion de novo — usa exatamente a versão informada. */
    frozenAgentDefinitionVersion?: number;
    reason?: 'INITIAL' | 'REVIEW_REWORK';
    attempt?: number;
  }): Promise<{
    agentExecutionId: string;
    startedAt: Date;
    agentDefinitionKey: string;
    agentDefinitionVersion: number;
  }> {
    const job = await this.prisma.generationJob.findUnique({ where: { id: input.jobId } });
    if (!job || job.missionId !== input.missionId) throw new Error('CONTEXT_MISSION_MISMATCH');

    const agentDefinitionKey = job.agentKey;
    let agentDefinitionVersion: number;
    if (input.frozenAgentDefinitionVersion !== undefined) {
      agentDefinitionVersion = input.frozenAgentDefinitionVersion;
    } else {
      // §4 (CORE-004): resolve por currentVersion SOMENTE para iniciar, depois congela.
      const agentDefVersion = await this.catalog.getCurrentVersion(job.agentKey);
      if (!agentDefVersion) throw new Error('AGENT_VERSION_NOT_FOUND');
      agentDefinitionVersion = agentDefVersion.version;
    }

    const agentExecutionId = randomUUID();
    const startedAt = new Date();
    await this.prisma.agentExecution.create({
      data: {
        id: agentExecutionId,
        missionId: input.missionId,
        generationJobId: job.id,
        agentKey: job.agentKey,
        agentDefinitionKey,
        agentDefinitionVersion,
        agentInstanceId: input.agentInstanceId ?? null,
        mode: 'COGNITIVE',
        attempt: input.attempt ?? 1,
        reason: input.reason ?? 'INITIAL',
        status: 'RUNNING',
        startedAt,
      },
    });

    return { agentExecutionId, startedAt, agentDefinitionKey, agentDefinitionVersion };
  }

  async runAnalysisPhase(ctx: PhaseContext): Promise<{ result: AnalysisResultV1; stepId: string }> {
    return this.runPhase<AnalysisResultV1>({
      ...ctx, phase: 'ANALYSIS', purpose: 'ANALYSIS', attempt: 1, previousStepSummaries: [],
      schemaKey: 'AnalysisResultV1', schemaVersion: 'v1', validate: validateAnalysisResult,
    });
  }

  async runPlanningPhase(ctx: PhaseContext, previousStepSummaries: PreviousStepSummary[]): Promise<{ result: ImplementationPlanV1; stepId: string }> {
    return this.runPhase<ImplementationPlanV1>({
      ...ctx, phase: 'PLANNING', purpose: 'PLANNING', attempt: 1, previousStepSummaries,
      schemaKey: 'ImplementationPlanV1', schemaVersion: 'v1', validate: validateImplementationPlan,
    });
  }

  async runImplementationPhase(ctx: PhaseContext, previousStepSummaries: PreviousStepSummary[], attempt: number): Promise<{ result: ChangeSetProposalV1; stepId: string }> {
    return this.runPhase<ChangeSetProposalV1>({
      ...ctx, phase: 'IMPLEMENTATION', purpose: 'IMPLEMENTATION', attempt, previousStepSummaries,
      schemaKey: 'ChangeSetProposalV1', schemaVersion: 'v1', validate: validateChangeSetProposal,
    });
  }

  async runSelfCheckPhase(ctx: PhaseContext, previousStepSummaries: PreviousStepSummary[], attempt: number): Promise<{ result: SelfCheckResultV1; stepId: string }> {
    return this.runPhase<SelfCheckResultV1>({
      ...ctx, phase: 'SELF_CHECK', purpose: 'SELF_CHECK', attempt, previousStepSummaries,
      schemaKey: 'SelfCheckResultV1', schemaVersion: 'v1', validate: validateSelfCheckResult,
    });
  }

  /** CORE-010: one independent reviewer execution, using the exact frozen reviewer version and
   * the exact isolated candidate as runtime-only untrusted context. */
  async runIndependentReview(input: {
    missionId: string;
    jobId: string;
    reviewerAgentDefinitionKey: string;
    reviewerAgentDefinitionVersion: number;
    reviewerAgentInstanceId?: string;
    candidateReviewContext: CandidateReviewContext;
    agentExecutionId?: string;
  }): Promise<{ agentExecutionId: string; result: CodeReviewResultV1; stepId: string }> {
    const startedAt = new Date();
    const agentExecutionId = input.agentExecutionId ?? randomUUID();
    await this.prisma.agentExecution.create({ data: {
      id: agentExecutionId, missionId: input.missionId, generationJobId: input.jobId,
      agentKey: input.reviewerAgentDefinitionKey, agentDefinitionKey: input.reviewerAgentDefinitionKey,
      agentDefinitionVersion: input.reviewerAgentDefinitionVersion,
      agentInstanceId: input.reviewerAgentInstanceId ?? null, mode: 'COGNITIVE', attempt: 1,
      reason: 'INDEPENDENT_REVIEW', status: 'RUNNING', startedAt,
    }});
    try {
      const phase = await this.runPhase<CodeReviewResultV1>({
        missionId: input.missionId, jobId: input.jobId, agentExecutionId,
        agentDefinitionKey: input.reviewerAgentDefinitionKey,
        agentDefinitionVersion: input.reviewerAgentDefinitionVersion,
        phase: 'REVIEW', purpose: 'REVIEW', attempt: 1, previousStepSummaries: [],
        schemaKey: 'CodeReviewResultV1', schemaVersion: 'v1', validate: validateCodeReviewResult,
        candidateReviewContext: input.candidateReviewContext,
      });
      await this.finishExecution(agentExecutionId, startedAt, 'SUCCEEDED', { confidenceScore: phase.result.confidence });
      return { agentExecutionId, result: phase.result, stepId: phase.stepId };
    } catch (error) {
      const code = error instanceof Error ? error.message : 'REVIEW_EXECUTION_FAILED';
      const count = await this.ledger.countInvocations(agentExecutionId);
      if (count > 0) await this.finishExecution(agentExecutionId, startedAt, 'FAILED', { errorCode: code });
      else await this.prisma.agentExecution.update({ where: { id: agentExecutionId }, data: { status: 'FAILED', errorCode: code, completedAt: new Date() } });
      throw new ReviewExecutionFailedError(agentExecutionId, code);
    }
  }

  /** External engineering rework: a new executor AgentExecution and a new ChangeSetProposalV1.
   * It is intentionally distinct from schema repair and from same-execution self-check repair. */
  async executeExternalReviewRework(input: {
    missionId: string;
    jobId: string;
    executorAgentDefinitionKey: string;
    executorAgentDefinitionVersion: number;
    reviewCycle: number;
    evidenceSummaries: PreviousStepSummary[];
  }): Promise<{ agentExecutionId: string; changeset: ChangeSetProposalV1 }> {
    const frozenExecutor = await this.catalog.getVersion(input.executorAgentDefinitionKey, input.executorAgentDefinitionVersion);
    if (!frozenExecutor?.publishedAt || !frozenExecutor.canExecute) throw new Error('REWORK_EXECUTOR_VERSION_NOT_AVAILABLE');
    const begun = await this.beginStructuredExecution({
      missionId: input.missionId, jobId: input.jobId,
      frozenAgentDefinitionVersion: input.executorAgentDefinitionVersion,
      reason: 'REVIEW_REWORK', attempt: input.reviewCycle,
    });
    if (begun.agentDefinitionKey !== input.executorAgentDefinitionKey) throw new Error('REWORK_EXECUTOR_IDENTITY_MISMATCH');
    const ctx: PhaseContext = { missionId: input.missionId, jobId: input.jobId, agentExecutionId: begun.agentExecutionId,
      agentDefinitionKey: begun.agentDefinitionKey, agentDefinitionVersion: begun.agentDefinitionVersion };
    try {
      const phase = await this.runImplementationPhase(ctx, input.evidenceSummaries, 1);
      await this.finishExecution(begun.agentExecutionId, begun.startedAt, 'SUCCEEDED', { confidenceScore: phase.result.confidence });
      return { agentExecutionId: begun.agentExecutionId, changeset: phase.result };
    } catch (error) {
      const current = await this.prisma.agentExecution.findUnique({ where: { id: begun.agentExecutionId } });
      if (current?.status === 'RUNNING') await this.finishExecution(begun.agentExecutionId, begun.startedAt, 'FAILED', { errorCode: error instanceof Error ? error.message : 'REWORK_EXECUTION_FAILED' });
      throw error;
    }
  }

  summarizeAnalysisResult(result: AnalysisResultV1): PreviousStepSummary {
    return this.summarizeAnalysis(result);
  }
  summarizePlanResult(result: ImplementationPlanV1): PreviousStepSummary {
    return this.summarizePlan(result);
  }
  summarizeChangeSetResult(result: ChangeSetProposalV1): PreviousStepSummary {
    return this.summarizeChangeSet(result);
  }
  summarizeSelfCheckFindingsResult(result: SelfCheckResultV1): PreviousStepSummary {
    return this.summarizeSelfCheckFindings(result);
  }

  /** Convenience wrapper (CORE-004): as 4 fases + repair de self-check, sequenciais, sem FSM
   * observável — mantido para compatibilidade com os testes/call sites já existentes. */
  async runStructuredJob(input: { missionId: string; jobId: string }): Promise<StructuredJobResult> {
    const { agentExecutionId, startedAt, agentDefinitionKey, agentDefinitionVersion } = await this.beginStructuredExecution(input);
    const ctx: PhaseContext = { missionId: input.missionId, jobId: input.jobId, agentExecutionId, agentDefinitionKey, agentDefinitionVersion };

    try {
      const analysis = await this.runAnalysisPhase(ctx);
      const analysisSummary = this.summarizeAnalysis(analysis.result);

      const plan = await this.runPlanningPhase(ctx, [analysisSummary]);
      const planSummary = this.summarizePlan(plan.result);

      let changeset = await this.runImplementationPhase(ctx, [analysisSummary, planSummary], 1);
      let changesetSummary = this.summarizeChangeSet(changeset.result);

      let selfCheck = await this.runSelfCheckPhase(ctx, [analysisSummary, planSummary, changesetSummary], 1);

      // §22: no máximo 1 repair pass interno ao mesmo AgentExecution, disparado por NEEDS_REPAIR.
      if (selfCheck.result.verdict === 'NEEDS_REPAIR') {
        const repairSummary = this.summarizeSelfCheckFindings(selfCheck.result);
        changeset = await this.runImplementationPhase(ctx, [analysisSummary, planSummary, changesetSummary, repairSummary], 2);
        changesetSummary = this.summarizeChangeSet(changeset.result);

        selfCheck = await this.runSelfCheckPhase(ctx, [analysisSummary, planSummary, changesetSummary], 2);

        if (selfCheck.result.verdict === 'NEEDS_REPAIR') {
          await this.finishExecution(agentExecutionId, startedAt, 'FAILED', { errorCode: 'SELF_CHECK_REPAIR_EXHAUSTED' });
          throw new Error('SELF_CHECK_REPAIR_EXHAUSTED');
        }
      }

      // §21: política determinística e documentada — o mínimo entre as 4 fases, nunca ML.
      const confidenceScore = Math.min(analysis.result.confidence, plan.result.confidence, changeset.result.confidence, selfCheck.result.confidence);
      await this.finishExecution(agentExecutionId, startedAt, 'SUCCEEDED', { confidenceScore });

      return {
        agentExecutionId,
        status: 'SUCCEEDED',
        agentDefinitionKey,
        agentDefinitionVersion,
        analysis: analysis.result,
        plan: plan.result,
        changeset: changeset.result,
        selfCheck: selfCheck.result,
        confidenceScore,
      };
    } catch (err) {
      const current = await this.prisma.agentExecution.findUnique({ where: { id: agentExecutionId } });
      if (current && current.status === 'RUNNING') {
        const errorCode = err instanceof Error ? err.message : 'AGENT_EXECUTION_FAILED';
        await this.finishExecution(agentExecutionId, startedAt, 'FAILED', { errorCode });
      }
      throw err;
    }
  }

  async finishExecution(
    agentExecutionId: string,
    startedAt: Date,
    status: 'SUCCEEDED' | 'FAILED',
    extra: { confidenceScore?: number; errorCode?: string }
  ): Promise<void> {
    // §18/Inv.2 (CORE-001): nenhuma AgentExecution COGNITIVE termina sem >=1 LlmInvocationRecord.
    const invocationCount = await this.ledger.countInvocations(agentExecutionId);
    assertCognitiveInvariant('COGNITIVE', invocationCount);

    const completedAt = new Date();
    await this.prisma.agentExecution.update({
      where: { id: agentExecutionId },
      data: { status, completedAt, elapsedMs: completedAt.getTime() - startedAt.getTime(), confidenceScore: extra.confidenceScore ?? null, errorCode: extra.errorCode ?? null },
    });
  }

  /**
   * Uma fase cognitiva completa: PromptMaster.compile() → LlmGateway (LlmClient existente) →
   * structured-output parser → validate. Se inválido (JSON malformado OU schema incorreto): até
   * 1 correction attempt (§7) — nova LlmInvocationRecord com purpose=REPAIR, mesmo AgentExecution,
   * mesmo AgentCognitiveStep (linha única por outer attempt; a linha guarda a referência da
   * ÚLTIMA invocation usada — a(s) anterior(es) continuam no ledger, nunca apagadas). Se a 2ª
   * tentativa também falhar: STRUCTURED_OUTPUT_REPAIR_EXHAUSTED.
   */
  private async runPhase<T>(params: {
    missionId: string;
    jobId: string;
    agentExecutionId: string;
    agentDefinitionKey: string;
    agentDefinitionVersion: number;
    phase: 'ANALYSIS' | 'PLANNING' | 'IMPLEMENTATION' | 'SELF_CHECK' | 'REVIEW';
    purpose: PromptPurpose;
    attempt: number;
    previousStepSummaries: PreviousStepSummary[];
    schemaKey: string;
    schemaVersion: string;
    validate: (raw: unknown) => T | null;
    candidateReviewContext?: CandidateReviewContext;
  }): Promise<{ result: T; stepId: string }> {
    // Idempotência mínima (§30): duas chamadas com o mesmo (execution, phase, attempt) colidem no
    // unique index — nunca duplica silenciosamente uma tentativa já registrada.
    const stepId = randomUUID();

    let compiledPromptSnapshotId: string | null = null;
    let lastInvocationId: string | null = null;
    let lastErrorReason: string | null = null;
    let finalResult: T | null = null;

    for (let subAttempt = 1; subAttempt <= 2; subAttempt++) {
      const purpose: PromptPurpose = subAttempt === 1 ? params.purpose : 'REPAIR';
      const previousStepSummaries =
        subAttempt === 1
          ? params.previousStepSummaries
          : [...params.previousStepSummaries, { purpose: params.purpose, summary: `A resposta anterior falhou validação de schema (${lastErrorReason}). Responda de novo SOMENTE com JSON válido no formato ${params.schemaKey}.` }];

      let compiled;
      try {
        compiled = await this.promptMaster.compile({
          missionId: params.missionId,
          jobId: params.jobId,
          agentDefinitionKey: params.agentDefinitionKey,
          agentDefinitionVersion: params.agentDefinitionVersion,
          purpose,
          agentExecutionId: params.agentExecutionId,
          previousStepSummaries,
          persistSnapshot: true,
          candidateReviewContext: params.candidateReviewContext,
        });
      } catch (err) {
        throw err instanceof Error ? err : new Error('PROMPT_COMPILATION_FAILED');
      }
      compiledPromptSnapshotId = compiled.promptSnapshotId;

      if (subAttempt === 1) {
        await this.prisma.agentCognitiveStep.create({
          data: {
            id: stepId, agentExecutionId: params.agentExecutionId, phase: params.phase,
            schemaKey: params.schemaKey, schemaVersion: params.schemaVersion,
            resultJson: {}, resultHash: '', promptSnapshotId: compiledPromptSnapshotId, attempt: params.attempt, status: 'RUNNING',
          },
        });
      } else {
        await this.prisma.agentCognitiveStep.update({ where: { id: stepId }, data: { promptSnapshotId: compiledPromptSnapshotId } });
      }

      const invocationId = await this.ledger.startInvocation({
        missionId: params.missionId,
        agentExecutionId: params.agentExecutionId,
        purpose,
        promptSnapshotId: compiledPromptSnapshotId ?? undefined,
      });
      lastInvocationId = invocationId;

      let raw: LlmCompletionResult;
      try {
        raw = await this.llm.complete({ system: compiled.compiled.systemText, user: compiled.compiled.userText, responseFormat: 'json_object' });
      } catch {
        await this.ledger.failInvocation(invocationId, 'LLM_INVOCATION_FAILED');
        await this.prisma.agentCognitiveStep.update({ where: { id: stepId }, data: { status: 'FAILED', llmInvocationId: invocationId } });
        throw new Error('LLM_INVOCATION_FAILED');
      }
      await this.ledger.completeInvocation(invocationId, { provider: 'deepseek', model: raw.model, inputTokens: raw.promptTokens, outputTokens: raw.completionTokens });

      const parsedJson = this.parseJson<unknown>(raw.text);
      const validated = parsedJson !== null ? params.validate(parsedJson) : null;
      if (validated) {
        finalResult = validated;
        break;
      }
      lastErrorReason = parsedJson === null ? 'JSON_PARSE_FAILED' : 'COGNITIVE_OUTPUT_INVALID';
    }

    if (!finalResult) {
      await this.prisma.agentCognitiveStep.update({ where: { id: stepId }, data: { status: 'FAILED', llmInvocationId: lastInvocationId } });
      throw new Error('STRUCTURED_OUTPUT_REPAIR_EXHAUSTED');
    }

    const resultHash = canonicalHash(finalResult);
    await this.prisma.agentCognitiveStep.update({
      where: { id: stepId },
      data: { status: 'SUCCEEDED', resultJson: finalResult as object, resultHash, llmInvocationId: lastInvocationId },
    });

    return { result: finalResult, stepId };
  }

  // Structured summaries — nunca chain-of-thought (§12/§31): só os campos já estruturados do
  // resultado validado, resumidos em texto curto e determinístico.
  private summarizeAnalysis(result: AnalysisResultV1): PreviousStepSummary {
    return {
      purpose: 'ANALYSIS',
      summary: `Understanding: ${result.understanding} Affected areas: ${result.affectedAreas.join(', ') || '(none)'}. Risks: ${result.risks.length}. Confidence: ${result.confidence}.`,
    };
  }

  private summarizePlan(result: ImplementationPlanV1): PreviousStepSummary {
    return {
      purpose: 'PLANNING',
      summary: `Steps: ${result.steps.length}. Creates: ${result.expectedCreates.join(', ') || '(none)'}. Modifies: ${result.expectedModifies.join(', ') || '(none)'}. Confidence: ${result.confidence}.`,
    };
  }

  private summarizeChangeSet(result: ChangeSetProposalV1): PreviousStepSummary {
    return {
      purpose: 'IMPLEMENTATION',
      summary: `Changes: ${result.changes.map((c) => `${c.operation} ${c.path}`).join('; ') || '(none)'}. Confidence: ${result.confidence}.`,
    };
  }

  private summarizeSelfCheckFindings(result: SelfCheckResultV1): PreviousStepSummary {
    return {
      purpose: 'SELF_CHECK',
      summary: `Verdict: NEEDS_REPAIR. Findings: ${result.findings.map((f) => `[${f.severity}] ${f.category}: ${f.issue}`).join(' | ') || '(none)'}`,
    };
  }

  async implement(
    job: PlannedJob,
    currentFileContent: string,
    missionId: string,
    agentExecutionId: string,
    repairContext?: RepairContext
  ): Promise<AgentExecutionResult> {
    const startedAt = Date.now();
    const system = this.buildSystemPrompt(job, repairContext);
    const user = `Arquivo atual (${job.targetFile}):\n\`\`\`typescript\n${currentFileContent}\n\`\`\`\n\nRegra de negócio a implementar:\n"${job.requirementText}"`;

    const promptSnapshotId = await this.ledger.snapshotPrompt({
      missionId,
      agentExecutionId,
      promptType: 'job.implement',
      promptVersion: 'v1',
      contextForHash: { requirementText: job.requirementText, targetFile: job.targetFile, currentFileContent, repairContext },
      system,
      user,
      refs: { requirementId: job.requirementId, targetFile: job.targetFile },
    });
    const invocationId = await this.ledger.startInvocation({
      missionId,
      agentExecutionId,
      purpose: 'job.implement',
      promptSnapshotId,
    });

    let raw: { text: string; model: string; promptTokens: number; completionTokens: number };
    try {
      raw = await this.completeWithTimeout(system, user);
    } catch (err) {
      const errorCode = err instanceof Error && err.message === 'AGENT_TIMEOUT' ? 'AGENT_TIMEOUT' : 'AGENT_LLM_UNAVAILABLE';
      await this.ledger.failInvocation(invocationId, errorCode);
      return this.failed(errorCode, Date.now() - startedAt);
    }

    await this.ledger.completeInvocation(invocationId, {
      provider: 'deepseek',
      model: raw.model,
      inputTokens: raw.promptTokens,
      outputTokens: raw.completionTokens,
    });

    const parsed = this.parseJson<AgentJsonResponse>(raw.text);
    if (!parsed || !parsed.updatedFileContent) {
      return this.failed('AGENT_MALFORMED_RESPONSE', Date.now() - startedAt);
    }

    const structuralError = this.validateStructure(currentFileContent, parsed.updatedFileContent, job.targetResource);
    if (structuralError) {
      return this.failed(structuralError, Date.now() - startedAt, { analysisText: parsed.analysis, planText: parsed.plan });
    }

    return {
      status: 'IMPLEMENTED',
      analysisText: parsed.analysis ?? null,
      planText: parsed.plan ?? null,
      implementationSummary: parsed.implementationSummary ?? null,
      updatedFileContent: parsed.updatedFileContent,
      provider: 'deepseek',
      model: raw.model,
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
      latencyMs: Date.now() - startedAt,
      errorCode: null,
    };
  }

  private buildSystemPrompt(job: PlannedJob, repairContext?: RepairContext): string {
    const repairNotice = repairContext
      ? `\n\nESTA É UMA TENTATIVA DE REPARO (tentativa ${repairContext.attemptNumber}) — sua tentativa anterior falhou porque: ${ERROR_EXPLANATIONS[repairContext.previousErrorCode] ?? repairContext.previousErrorCode}. Corrija especificamente esse problema desta vez.`
      : '';
    return `Você é o agente ${job.agentKey} do LDCN OS, implementando uma regra de negócio real em um backend NestJS/TypeScript já gerado.

REGRA CRÍTICA DE ESCOPO (nunca violar): você só pode ADICIONAR um novo método público (e, se precisar, campos/métodos privados de apoio) à classe de serviço. Você NUNCA pode modificar, remover ou renomear nenhum método, propriedade ou assinatura já existente (list, get, create, a interface exportada, os imports do topo) — outro arquivo (o controller) depende exatamente dessa forma atual e não será regenerado. Se a regra de negócio precisar de dados que a entidade atual não tem, adicione parâmetros ao novo método em vez de mudar a entidade.
${repairNotice}

${OUTPUT_SCHEMA}`;
  }

  /** "Ferramenta mede. Validator verifica." — nunca aplica um ChangeSet sem provar mecanicamente
   * que a superfície pública que o controller usa continua intacta. */
  private validateStructure(original: string, updated: string, entityName: string): string | null {
    if (updated.trim().length < original.trim().length * 0.5) return 'AGENT_SUSPICIOUSLY_SHORT_OUTPUT';
    const requiredSubstrings = [
      '@Injectable()',
      `export interface ${entityName} {`,
      `export class ${entityName}Service {`,
      `list(): ${entityName}[] {`,
      `get(id: string): ${entityName} | undefined {`,
      `create(name: string): ${entityName} {`,
    ];
    for (const required of requiredSubstrings) {
      if (!updated.includes(required)) return 'AGENT_SCOPE_VIOLATION';
    }
    return null;
  }

  private failed(errorCode: string, latencyMs: number, extra: { analysisText?: string; planText?: string } = {}): AgentExecutionResult {
    return {
      status: 'FAILED', analysisText: extra.analysisText ?? null, planText: extra.planText ?? null,
      implementationSummary: null, updatedFileContent: null, provider: null, model: null,
      promptTokens: null, completionTokens: null, latencyMs, errorCode,
    };
  }

  private completeWithTimeout(system: string, user: string): Promise<{ text: string; model: string; promptTokens: number; completionTokens: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AGENT_TIMEOUT')), this.reviewerTimeoutMs);
      this.llm.complete({ system, user, responseFormat: 'json_object' }).then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  private parseJson<T>(text: string): T | null {
    try {
      const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}
