import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AgentExecution, AgentInstance, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { AgentExecutionService, PhaseContext, StructuredJobResult } from '../generation-engine/agent-execution.service';
import { EventLogService } from '../events/event-log.service';
import { AgentRuntimeState, TERMINAL_STATES, assertTransition } from './fsm';

const FORBIDDEN_TERMS = ['apikey', 'api_key', 'secret', 'credential', 'password', 'bearer '];
const DEFAULT_EXECUTION_DEADLINE_MS = 300_000;

/** CORE-006 §4 — advanceState() cobre a família "state changed"; transições terminais e a
 * convocação inicial também emitem o evento específico nomeado. */
const STATE_EVENT_MAP: Record<string, string> = {
  AGENT_SUMMONED: 'agent.summoned',
  AGENT_COMPLETED: 'agent.completed',
  AGENT_FAILED: 'agent.failed',
  AGENT_CANCELLED: 'agent.cancelled',
};

/** recordEvent() cobre a família de fatos de conclusão de fase — nunca uma transição de estado. */
const PHASE_EVENT_MAP: Record<string, string> = {
  CONTEXT_READY: 'agent.context_ready',
  ANALYSIS_COMPLETED: 'agent.analysis_completed',
  PLANNING_COMPLETED: 'agent.planning_completed',
  IMPLEMENTATION_COMPLETED: 'agent.implementation_completed',
  SELF_CHECK_COMPLETED: 'agent.selfcheck_completed',
};

export interface SummonInput {
  missionId: string;
  jobId: string;
  agentInstanceId: string;
  executionDeadlineMs?: number;
}

export interface SummonHooks {
  /** Seam de teste/observabilidade: chamado logo antes de cada tentativa de transição de fase —
   * permite provar cancelamento/timeout de forma determinística (doc CORE-005 §31 X/Y). */
  onBeforePhase?: (info: { executionId: string; from: AgentRuntimeState; to: AgentRuntimeState }) => Promise<void> | void;
}

export type SummonOutcome =
  | (StructuredJobResult & { finalState: 'COMPLETED'; idempotentReplay?: false })
  | { agentExecutionId: string; status: 'FAILED'; finalState: 'FAILED'; errorCode: string; idempotentReplay?: false }
  | { agentExecutionId: string; status: 'CANCELLED'; finalState: 'CANCELLED'; errorCode: 'AGENT_EXECUTION_CANCELLED'; idempotentReplay?: false }
  | { agentExecutionId: string; status: 'RUNNING'; finalState: AgentRuntimeState; idempotentReplay: true };

interface RuntimeCtx {
  missionId: string;
  jobId: string;
  agentInstanceId: string;
  agentExecutionId: string;
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
  startedAt: Date;
  deadlineAt: number;
}

/**
 * CORE-005 — camada operacional (FSM) sobre a capacidade cognitiva já pronta desde CORE-004.
 * NUNCA reimplementa ANALYSIS/PLANNING/IMPLEMENTATION/SELF_CHECK/structured repair — orquestra os
 * métodos phase-by-phase de AgentExecutionService, controlando estado/timeline/heartbeat/timeout/
 * cancelamento em torno deles. AgentExecution continua o envelope canônico da tentativa cognitiva;
 * AgentInstance é a camada nova: identidade mission-scoped, versão congelada, estado operacional.
 */
@Injectable()
export class AgentRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AgentCatalogService,
    private readonly contextLoader: ContextLoaderService,
    private readonly agentExecution: AgentExecutionService,
    private readonly eventLog: EventLogService
  ) {}

  // ---------------------------------------------------------------------
  // AgentInstance provisioning — §2/§23: nesta CORE, criado diretamente (fixture/teste/
  // GenerationEngineService), nunca por um TeamComposer real (isso é CORE-017).
  // ---------------------------------------------------------------------

  /** Idempotente: uma instância por (missionId, agentDefinitionKey) — get-or-create. A versão é
   * congelada NA CRIAÇÃO via getCurrentVersion (única vez); reexecuções nunca re-congelam. */
  async ensureInstance(input: { missionId: string; agentDefinitionKey: string }): Promise<AgentInstance> {
    const existing = await this.prisma.agentInstance.findUnique({
      where: { missionId_agentDefinitionKey: { missionId: input.missionId, agentDefinitionKey: input.agentDefinitionKey } },
    });
    if (existing) return existing;

    const agentDefVersion = await this.catalog.getCurrentVersion(input.agentDefinitionKey);
    if (!agentDefVersion) throw new Error('AGENT_VERSION_NOT_FOUND');

    return this.prisma.agentInstance.create({
      data: {
        id: randomUUID(),
        missionId: input.missionId,
        agentDefinitionKey: input.agentDefinitionKey,
        agentDefinitionVersion: agentDefVersion.version,
        state: 'IDLE',
      },
    });
  }

  /** Creates an instance frozen to an explicitly resolved catalog version. Used by review so a
   * currentVersion promotion racing the operation cannot change reviewer identity mid-flight. */
  async ensureInstanceExact(input: { missionId: string; agentDefinitionKey: string; agentDefinitionVersion: number }): Promise<AgentInstance> {
    const version = await this.catalog.getVersion(input.agentDefinitionKey, input.agentDefinitionVersion);
    if (!version?.publishedAt) throw new Error('AGENT_VERSION_NOT_FOUND');
    const existing = await this.prisma.agentInstance.findUnique({
      where: { missionId_agentDefinitionKey: { missionId: input.missionId, agentDefinitionKey: input.agentDefinitionKey } },
    });
    if (existing) {
      if (existing.agentDefinitionVersion !== input.agentDefinitionVersion) throw new Error('AGENT_INSTANCE_VERSION_MISMATCH');
      return existing;
    }
    return this.prisma.agentInstance.create({ data: {
      id: randomUUID(), missionId: input.missionId, agentDefinitionKey: input.agentDefinitionKey,
      agentDefinitionVersion: input.agentDefinitionVersion, state: 'IDLE',
    }});
  }

  // ---------------------------------------------------------------------
  // Summon — o ciclo completo IDLE → ... → COMPLETED/FAILED/CANCELLED.
  // ---------------------------------------------------------------------

  async summon(input: SummonInput, hooks: SummonHooks = {}): Promise<SummonOutcome> {
    const instance = await this.prisma.agentInstance.findUnique({ where: { id: input.agentInstanceId } });
    if (!instance) throw new Error('AGENT_INSTANCE_NOT_FOUND');
    if (instance.missionId !== input.missionId) throw new Error('AGENT_JOB_MISSION_MISMATCH');

    const job = await this.prisma.generationJob.findUnique({ where: { id: input.jobId } });
    if (!job) throw new Error('CONTEXT_MISSION_MISMATCH');
    if (job.missionId !== instance.missionId) throw new Error('AGENT_JOB_MISSION_MISMATCH');

    // §26: idempotente — mesma instância + mesmo Job já RUNNING retorna a execução existente.
    if (instance.currentJobId === job.id) {
      const existingRunning = await this.prisma.agentExecution.findFirst({
        where: { agentInstanceId: instance.id, generationJobId: job.id, status: 'RUNNING' },
        orderBy: { createdAt: 'desc' },
      });
      if (existingRunning) {
        return { agentExecutionId: existingRunning.id, status: 'RUNNING', finalState: instance.state as AgentRuntimeState, idempotentReplay: true };
      }
    }

    // §19: mesma instância nunca executa dois Jobs simultaneamente.
    const effectiveState: AgentRuntimeState = TERMINAL_STATES.has(instance.state as AgentRuntimeState) ? 'IDLE' : (instance.state as AgentRuntimeState);
    if (instance.currentJobId && instance.currentJobId !== job.id && effectiveState !== 'IDLE') {
      throw new Error('AGENT_ALREADY_BUSY');
    }

    assertTransition(effectiveState, 'SUMMONED');
    // Cria a AgentExecution ANTES da transição IDLE→SUMMONED (mesmo que a fase real de trabalho
    // só comece em CONTEXT_LOADING) para que o timeline event de SUMMONED já referencie o
    // agentExecutionId real — getTimeline(executionId) precisa encontrá-lo.
    const { agentExecutionId, startedAt, agentDefinitionKey, agentDefinitionVersion } = await this.agentExecution.beginStructuredExecution({
      missionId: instance.missionId,
      jobId: job.id,
      agentInstanceId: instance.id,
      frozenAgentDefinitionVersion: instance.agentDefinitionVersion,
    });

    await this.advanceState(
      { missionId: instance.missionId, jobId: job.id, agentInstanceId: instance.id, agentExecutionId },
      effectiveState,
      'SUMMONED',
      'AGENT_SUMMONED'
    );
    await this.prisma.agentInstance.update({ where: { id: instance.id }, data: { currentJobId: job.id } });

    const ctx: RuntimeCtx = {
      missionId: instance.missionId,
      jobId: job.id,
      agentInstanceId: instance.id,
      agentExecutionId,
      agentDefinitionKey,
      agentDefinitionVersion,
      startedAt,
      deadlineAt: Date.now() + (input.executionDeadlineMs ?? DEFAULT_EXECUTION_DEADLINE_MS),
    };

    return this.runToCompletion(ctx, hooks);
  }

  private async runToCompletion(ctx: RuntimeCtx, hooks: SummonHooks): Promise<SummonOutcome> {
    const phaseCtx: PhaseContext = {
      missionId: ctx.missionId, jobId: ctx.jobId, agentExecutionId: ctx.agentExecutionId,
      agentDefinitionKey: ctx.agentDefinitionKey, agentDefinitionVersion: ctx.agentDefinitionVersion,
    };

    try {
      // SUMMONED → CONTEXT_LOADING
      let stop = await this.shouldStop(ctx, 'SUMMONED', 'CONTEXT_LOADING', hooks);
      if (stop) return stop;
      await this.advanceState(ctx, 'SUMMONED', 'CONTEXT_LOADING', 'CONTEXT_LOADING_STARTED');

      try {
        await this.contextLoader.load({ missionId: ctx.missionId, jobId: ctx.jobId, agentDefinitionKey: ctx.agentDefinitionKey, agentDefinitionVersion: ctx.agentDefinitionVersion });
      } catch (err) {
        // §12: nunca mascara o errorCode original do ContextLoader/PromptMaster.
        return this.fail(ctx, 'CONTEXT_LOADING', err instanceof Error ? err.message : 'CONTEXT_LOADING_FAILED');
      }
      await this.recordEvent(ctx, 'CONTEXT_READY');

      // CONTEXT_LOADING → ANALYZING
      stop = await this.shouldStop(ctx, 'CONTEXT_LOADING', 'ANALYZING', hooks);
      if (stop) return stop;
      await this.advanceState(ctx, 'CONTEXT_LOADING', 'ANALYZING', 'ANALYSIS_STARTED');
      const analysis = await this.agentExecution.runAnalysisPhase(phaseCtx);
      await this.recordEvent(ctx, 'ANALYSIS_COMPLETED');
      const analysisSummary = this.agentExecution.summarizeAnalysisResult(analysis.result);

      // ANALYZING → PLANNING
      stop = await this.shouldStop(ctx, 'ANALYZING', 'PLANNING', hooks);
      if (stop) return stop;
      await this.advanceState(ctx, 'ANALYZING', 'PLANNING', 'PLANNING_STARTED');
      const plan = await this.agentExecution.runPlanningPhase(phaseCtx, [analysisSummary]);
      await this.recordEvent(ctx, 'PLANNING_COMPLETED');
      const planSummary = this.agentExecution.summarizePlanResult(plan.result);

      // PLANNING → IMPLEMENTING
      stop = await this.shouldStop(ctx, 'PLANNING', 'IMPLEMENTING', hooks);
      if (stop) return stop;
      await this.advanceState(ctx, 'PLANNING', 'IMPLEMENTING', 'IMPLEMENTATION_STARTED');
      let changeset = await this.agentExecution.runImplementationPhase(phaseCtx, [analysisSummary, planSummary], 1);
      await this.recordEvent(ctx, 'IMPLEMENTATION_COMPLETED');
      let changesetSummary = this.agentExecution.summarizeChangeSetResult(changeset.result);

      // IMPLEMENTING → SELF_CHECKING
      stop = await this.shouldStop(ctx, 'IMPLEMENTING', 'SELF_CHECKING', hooks);
      if (stop) return stop;
      await this.advanceState(ctx, 'IMPLEMENTING', 'SELF_CHECKING', 'SELF_CHECK_STARTED');
      let selfCheck = await this.agentExecution.runSelfCheckPhase(phaseCtx, [analysisSummary, planSummary, changesetSummary], 1);
      await this.recordEvent(ctx, 'SELF_CHECK_COMPLETED');

      if (selfCheck.result.verdict === 'NEEDS_REPAIR') {
        // SELF_CHECKING → IMPLEMENTING (repair interno) → SELF_CHECKING
        stop = await this.shouldStop(ctx, 'SELF_CHECKING', 'IMPLEMENTING', hooks);
        if (stop) return stop;
        await this.advanceState(ctx, 'SELF_CHECKING', 'IMPLEMENTING', 'SELF_CHECK_REPAIR_STARTED');
        const repairSummary = this.agentExecution.summarizeSelfCheckFindingsResult(selfCheck.result);
        changeset = await this.agentExecution.runImplementationPhase(phaseCtx, [analysisSummary, planSummary, changesetSummary, repairSummary], 2);
        await this.recordEvent(ctx, 'IMPLEMENTATION_COMPLETED');
        changesetSummary = this.agentExecution.summarizeChangeSetResult(changeset.result);

        stop = await this.shouldStop(ctx, 'IMPLEMENTING', 'SELF_CHECKING', hooks);
        if (stop) return stop;
        await this.advanceState(ctx, 'IMPLEMENTING', 'SELF_CHECKING', 'SELF_CHECK_STARTED');
        selfCheck = await this.agentExecution.runSelfCheckPhase(phaseCtx, [analysisSummary, planSummary, changesetSummary], 2);
        await this.recordEvent(ctx, 'SELF_CHECK_COMPLETED');

        if (selfCheck.result.verdict === 'NEEDS_REPAIR') {
          return this.fail(ctx, 'SELF_CHECKING', 'SELF_CHECK_REPAIR_EXHAUSTED');
        }
      }

      // SELF_CHECKING → COMPLETED
      const confidenceScore = Math.min(analysis.result.confidence, plan.result.confidence, changeset.result.confidence, selfCheck.result.confidence);
      await this.agentExecution.finishExecution(ctx.agentExecutionId, ctx.startedAt, 'SUCCEEDED', { confidenceScore });
      assertTransition('SELF_CHECKING', 'COMPLETED');
      await this.advanceState(ctx, 'SELF_CHECKING', 'COMPLETED', 'AGENT_COMPLETED', { confidenceScore });
      await this.recycleInstance(ctx.agentInstanceId, ctx.jobId);

      return {
        agentExecutionId: ctx.agentExecutionId, status: 'SUCCEEDED', finalState: 'COMPLETED',
        agentDefinitionKey: ctx.agentDefinitionKey, agentDefinitionVersion: ctx.agentDefinitionVersion,
        analysis: analysis.result, plan: plan.result, changeset: changeset.result, selfCheck: selfCheck.result, confidenceScore,
      };
    } catch (err) {
      const currentInstance = await this.prisma.agentInstance.findUnique({ where: { id: ctx.agentInstanceId } });
      const fromState = (currentInstance?.state as AgentRuntimeState) ?? 'SUMMONED';
      return this.fail(ctx, TERMINAL_STATES.has(fromState) ? 'SUMMONED' : fromState, err instanceof Error ? err.message : 'AGENT_EXECUTION_FAILED');
    }
  }

  /** Checa timeout/cancelamento antes de CADA transição de fase — nunca aborta uma chamada LLM já
   * em voo (o LlmClient atual não suporta abort externo); só impede a PRÓXIMA fase de começar
   * (doc §18/§17 — honesto: nunca finge abortar o que não abortou). Retorna o outcome real
   * (FAILED por timeout OU CANCELLED) quando deve parar, null para continuar — nunca adivinha
   * qual dos dois aconteceu. */
  private async shouldStop(ctx: RuntimeCtx, from: AgentRuntimeState, to: AgentRuntimeState, hooks: SummonHooks): Promise<SummonOutcome | null> {
    if (hooks.onBeforePhase) await hooks.onBeforePhase({ executionId: ctx.agentExecutionId, from, to });

    if (Date.now() > ctx.deadlineAt) {
      return this.fail(ctx, from, 'AGENT_EXECUTION_TIMEOUT');
    }

    const execution = await this.prisma.agentExecution.findUnique({ where: { id: ctx.agentExecutionId }, select: { cancelRequestedAt: true, cancelReason: true } });
    if (execution?.cancelRequestedAt) {
      return this.cancelFrom(ctx, from, execution.cancelReason);
    }
    return null;
  }

  private async fail(ctx: RuntimeCtx, fromState: AgentRuntimeState, errorCode: string): Promise<SummonOutcome> {
    // O invariante cognitivo do CORE-001 (assertCognitiveInvariant, via finishExecution) só faz
    // sentido quando pelo menos uma chamada de LLM foi tentada — uma falha pré-voo (CONTEXT_
    // OVERFLOW/AGENT_EXECUTION_TIMEOUT antes de ANALYZING/etc.) nunca chegou a "reivindicar
    // trabalho cognitivo sem prova": não reivindicou trabalho nenhum. Só passa por
    // finishExecution (que aplica o invariante) quando já existe >=1 invocation real.
    const invocationCount = await this.prisma.llmInvocationRecord.count({ where: { agentExecutionId: ctx.agentExecutionId } });
    if (invocationCount > 0) {
      await this.agentExecution.finishExecution(ctx.agentExecutionId, ctx.startedAt, 'FAILED', { errorCode });
    } else {
      const completedAt = new Date();
      await this.prisma.agentExecution.update({
        where: { id: ctx.agentExecutionId },
        data: { status: 'FAILED', errorCode, completedAt, elapsedMs: completedAt.getTime() - ctx.startedAt.getTime() },
      });
    }
    assertTransition(fromState, 'FAILED');
    await this.advanceState(ctx, fromState, 'FAILED', 'AGENT_FAILED', { errorCode });
    await this.recycleInstance(ctx.agentInstanceId, ctx.jobId);
    return { agentExecutionId: ctx.agentExecutionId, status: 'FAILED', finalState: 'FAILED', errorCode };
  }

  private async cancelFrom(ctx: RuntimeCtx, fromState: AgentRuntimeState, reason: string | null): Promise<SummonOutcome> {
    const completedAt = new Date();
    // CANCELLED nunca passa por finishExecution (que só aceita SUCCEEDED|FAILED) — uma execução
    // cancelada antes de qualquer LLM call legitimamente tem 0 LlmInvocationRecord, então o
    // invariante cognitivo do CORE-001 (que só se aplica a SUCCEEDED/FAILED) nunca é violado aqui.
    await this.prisma.agentExecution.update({
      where: { id: ctx.agentExecutionId },
      data: { status: 'CANCELLED', completedAt, elapsedMs: completedAt.getTime() - ctx.startedAt.getTime(), errorCode: 'AGENT_EXECUTION_CANCELLED' },
    });
    assertTransition(fromState, 'CANCELLED');
    await this.advanceState(ctx, fromState, 'CANCELLED', 'AGENT_CANCELLED', { reason: this.safeReason(reason) });
    await this.recycleInstance(ctx.agentInstanceId, ctx.jobId);
    return { agentExecutionId: ctx.agentExecutionId, status: 'CANCELLED', finalState: 'CANCELLED', errorCode: 'AGENT_EXECUTION_CANCELLED' };
  }

  private async recycleInstance(agentInstanceId: string, jobId: string): Promise<void> {
    await this.prisma.agentInstance.update({ where: { id: agentInstanceId }, data: { currentJobId: null, lastJobId: jobId } });
  }

  /** §7/§8/§11 (CORE-006): state change + timeline event + EventLog append na MESMA transação
   * curta (nunca aberta durante LLM) — persist first. Publica no EventBus só depois do commit. */
  private async advanceState(
    ctx: { missionId: string; jobId: string; agentInstanceId: string; agentExecutionId: string | null },
    from: AgentRuntimeState,
    to: AgentRuntimeState,
    type: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const safeMetadata = this.assertNoCredentials(metadata);
    const eventRow = await this.prisma.$transaction(async (tx) => {
      await tx.agentInstance.update({ where: { id: ctx.agentInstanceId }, data: { state: to } });
      await tx.agentRuntimeTimelineEvent.create({
        data: {
          id: randomUUID(), missionId: ctx.missionId, agentInstanceId: ctx.agentInstanceId,
          agentExecutionId: ctx.agentExecutionId, jobId: ctx.jobId, type, fromState: from, toState: to,
          metadataJson: safeMetadata as Prisma.InputJsonValue,
        },
      });
      if (ctx.agentExecutionId) {
        await tx.agentExecution.update({ where: { id: ctx.agentExecutionId }, data: { heartbeatAt: new Date() } });
      }
      return this.eventLog.appendWithinTransaction(tx, {
        missionId: ctx.missionId,
        correlationId: ctx.agentExecutionId ?? ctx.agentInstanceId,
        actorType: 'AGENT_RUNTIME',
        actorId: ctx.agentInstanceId,
        type: STATE_EVENT_MAP[type] ?? 'agent.state_changed',
        payload: { fromState: from, toState: to, jobId: ctx.jobId, agentExecutionId: ctx.agentExecutionId, ...safeMetadata },
      });
    });
    this.eventLog.publish(eventRow);
  }

  private async recordEvent(ctx: RuntimeCtx, type: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const safeMetadata = this.assertNoCredentials(metadata);
    const eventRow = await this.prisma.$transaction(async (tx) => {
      await tx.agentRuntimeTimelineEvent.create({
        data: {
          id: randomUUID(), missionId: ctx.missionId, agentInstanceId: ctx.agentInstanceId,
          agentExecutionId: ctx.agentExecutionId, jobId: ctx.jobId, type, metadataJson: safeMetadata as Prisma.InputJsonValue,
        },
      });
      return this.eventLog.appendWithinTransaction(tx, {
        missionId: ctx.missionId,
        correlationId: ctx.agentExecutionId,
        actorType: 'AGENT_RUNTIME',
        actorId: ctx.agentInstanceId,
        type: PHASE_EVENT_MAP[type] ?? type,
        payload: { jobId: ctx.jobId, agentExecutionId: ctx.agentExecutionId, ...safeMetadata },
      });
    });
    this.eventLog.publish(eventRow);
  }

  // ---------------------------------------------------------------------
  // Consulta / cancelamento externo / observabilidade
  // ---------------------------------------------------------------------

  async getExecution(executionId: string): Promise<AgentExecution> {
    const execution = await this.prisma.agentExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error('AGENT_EXECUTION_NOT_FOUND');
    return execution;
  }

  async getTimeline(executionId: string) {
    return this.prisma.agentRuntimeTimelineEvent.findMany({ where: { agentExecutionId: executionId }, orderBy: { createdAt: 'asc' } });
  }

  /** §18: só registra o pedido — a transição real para CANCELLED acontece no próximo phase
   * boundary do summon() correspondente (nunca finge abortar uma chamada LLM já em voo). */
  async cancel(executionId: string, reason: string): Promise<void> {
    const execution = await this.prisma.agentExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new Error('AGENT_EXECUTION_NOT_FOUND');
    if (execution.status !== 'RUNNING') throw new Error('AGENT_EXECUTION_ALREADY_TERMINAL');
    await this.prisma.agentExecution.update({
      where: { id: executionId },
      data: { cancelRequestedAt: new Date(), cancelReason: this.safeReason(reason) },
    });
  }

  /** §16: nunca marca FAILED automaticamente — só reporta candidatos a stale (RUNNING + heartbeat
   * antigo demais). Ver markStaleAsFailed() para o opt-in explícito. */
  async detectStaleExecutions(thresholdMs: number): Promise<AgentExecution[]> {
    const staleBefore = new Date(Date.now() - thresholdMs);
    return this.prisma.agentExecution.findMany({ where: { status: 'RUNNING', heartbeatAt: { lt: staleBefore } } });
  }

  async markStaleAsFailed(thresholdMs: number): Promise<number> {
    const stale = await this.detectStaleExecutions(thresholdMs);
    for (const execution of stale) {
      const completedAt = new Date();
      await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: { status: 'FAILED', errorCode: 'AGENT_EXECUTION_STALE', completedAt, elapsedMs: execution.startedAt ? completedAt.getTime() - execution.startedAt.getTime() : null },
      });
      if (execution.agentInstanceId) await this.recycleInstance(execution.agentInstanceId, execution.generationJobId ?? '');
    }
    return stale.length;
  }

  /** §27: métricas sempre derivadas do ledger (source of truth) — nunca um contador próprio. */
  async getMetrics(executionId: string): Promise<{ llmCalls: number; tokensIn: number; tokensOut: number; elapsedMs: number | null }> {
    const [execution, invocations] = await Promise.all([
      this.getExecution(executionId),
      this.prisma.llmInvocationRecord.findMany({ where: { agentExecutionId: executionId } }),
    ]);
    return {
      llmCalls: invocations.length,
      tokensIn: invocations.reduce((sum, i) => sum + (i.inputTokens ?? 0), 0),
      tokensOut: invocations.reduce((sum, i) => sum + (i.outputTokens ?? 0), 0),
      elapsedMs: execution.elapsedMs,
    };
  }

  private safeReason(reason: string | null | undefined): string {
    const text = (reason ?? 'no reason given').slice(0, 500);
    this.assertNoCredentials(text);
    return text;
  }

  private assertNoCredentials<T>(value: T): T {
    const text = JSON.stringify(value).toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      if (text.includes(term)) throw new Error(`AGENT_RUNTIME_CREDENTIAL_NOT_ALLOWED: forbidden term "${term.trim()}"`);
    }
    return value;
  }
}
