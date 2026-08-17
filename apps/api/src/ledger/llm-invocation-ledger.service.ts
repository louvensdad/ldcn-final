import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { EventLogService } from '../events/event-log.service';

/**
 * SLICE C1 "COGNITIVE EXECUTION FOUNDATION".
 *
 * Append-only ledger of real LLM calls. A row is created RUNNING before the provider
 * call and updated to SUCCEEDED/FAILED after — never held open across the call itself,
 * and never overwritten to represent a different attempt (retries get their own row).
 */

export interface SnapshotPromptInput {
  missionId: string;
  jobId?: string;
  agentExecutionId?: string;
  promptType: string;
  promptVersion: string;
  /** Used only to compute contextHash — never persisted raw. */
  contextForHash: unknown;
  system: string;
  user: string;
  refs?: Record<string, string>;
  outputSchemaKey?: string;
}

export interface StartInvocationInput {
  missionId: string;
  agentExecutionId?: string;
  architectureReviewerExecutionId?: string;
  purpose: string;
  phase?: string;
  promptSnapshotId?: string;
}

export interface CompleteInvocationInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
}

export interface LedgerLlmResult {
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface SnapshotCompiledPromptInput {
  missionId: string;
  jobId?: string;
  agentExecutionId?: string;
  agentDefinitionKey: string;
  agentDefinitionVersion: number;
  promptTemplateKey: string;
  promptTemplateVersion: string;
  purpose: string;
  contextHash: string;
  compiledPromptHash: string;
  outputSchemaKey: string;
  inputVersionRefsJson: Record<string, unknown>;
  capabilityRefs?: string[];
  knowledgeRefs?: string[];
  artifactRefs?: string[];
  contractRefs?: string[];
  requirementRefs?: string[];
}

export interface RecordLlmCallInput {
  missionId: string;
  agentExecutionId?: string;
  architectureReviewerExecutionId?: string;
  purpose: string;
  phase?: string;
  promptType: string;
  promptVersion: string;
  contextForHash: unknown;
  system: string;
  user: string;
  refs?: Record<string, string>;
  outputSchemaKey?: string;
  failureCode?: string;
}

@Injectable()
export class LlmInvocationLedgerService {
  private invocationStartTail: Promise<void> = Promise.resolve();

  constructor(private readonly prisma: PrismaService, @Optional() private readonly eventLog?: EventLogService) {}

  /** Central wrapper for mission-scoped LLM calls outside AgentExecution. */
  async recordLlmCall<T extends LedgerLlmResult>(input: RecordLlmCallInput, call: () => Promise<T>): Promise<T> {
    // Serialize only the RUNNING-row setup. Provider calls remain concurrent, but reviewers
    // receive deterministic ledger setup order and never race one another while creating audit rows.
    const previousStart = this.invocationStartTail;
    let releaseStart!: () => void;
    this.invocationStartTail = new Promise<void>((resolve) => { releaseStart = resolve; });
    await previousStart;

    let invocationId: string;
    try {
      const promptSnapshotId = await this.snapshotPrompt(input);
      invocationId = await this.startInvocation({
        missionId: input.missionId,
        agentExecutionId: input.agentExecutionId,
        architectureReviewerExecutionId: input.architectureReviewerExecutionId,
        purpose: input.purpose,
        phase: input.phase,
        promptSnapshotId,
      });
    } finally {
      releaseStart();
    }

    try {
      const result = await call();
      await this.completeInvocation(invocationId, {
        provider: 'deepseek',
        model: result.model,
        inputTokens: result.promptTokens,
        outputTokens: result.completionTokens,
      });
      return result;
    } catch (error) {
      const errorCode = input.failureCode ?? (error instanceof Error ? error.message.slice(0, 120) : 'LLM_CALL_FAILED');
      await this.failInvocation(invocationId, errorCode || 'LLM_CALL_FAILED');
      throw error;
    }
  }

  /**
   * CORE-003 — grava um CompiledPrompt (PromptMasterService) na mesma tabela PromptSnapshot,
   * usando as colunas aditivas da migration core003_promptmaster_context. Nunca sobrescreve nem
   * reusa os campos promptType/promptVersion/renderedPromptHash já usados pelos call sites
   * pré-CORE-003 (agent-execution.service.ts, review-council.service.ts, etc.) — grava os
   * próprios, também aditivos e sempre nullable, para nunca quebrar uma leitura antiga.
   */
  async snapshotCompiledPrompt(input: SnapshotCompiledPromptInput): Promise<string> {
    const id = randomUUID();
    await this.prisma.promptSnapshot.create({
      data: {
        id,
        missionId: input.missionId,
        jobId: input.jobId ?? null,
        agentExecutionId: input.agentExecutionId ?? null,
        promptType: `promptmaster.${input.purpose.toLowerCase()}`,
        promptVersion: `${input.promptTemplateKey}@${input.promptTemplateVersion}`,
        contextHash: input.contextHash,
        inputVersionRefsJson: input.inputVersionRefsJson as Prisma.InputJsonValue,
        outputSchemaKey: input.outputSchemaKey,
        renderedPromptHash: input.compiledPromptHash,
        agentDefinitionKey: input.agentDefinitionKey,
        agentDefinitionVersion: input.agentDefinitionVersion,
        promptTemplateKey: input.promptTemplateKey,
        promptTemplateVersion: input.promptTemplateVersion,
        purpose: input.purpose,
        compiledPromptHash: input.compiledPromptHash,
        capabilityRefsJson: (input.capabilityRefs ?? []) as Prisma.InputJsonValue,
        knowledgeRefsJson: (input.knowledgeRefs ?? []) as Prisma.InputJsonValue,
        artifactRefsJson: (input.artifactRefs ?? []) as Prisma.InputJsonValue,
        contractRefsJson: (input.contractRefs ?? []) as Prisma.InputJsonValue,
        requirementRefsJson: (input.requirementRefs ?? []) as Prisma.InputJsonValue,
      },
    });
    return id;
  }

  async snapshotPrompt(input: SnapshotPromptInput): Promise<string> {
    const id = randomUUID();
    await this.prisma.promptSnapshot.create({
      data: {
        id,
        missionId: input.missionId,
        jobId: input.jobId ?? null,
        agentExecutionId: input.agentExecutionId ?? null,
        promptType: input.promptType,
        promptVersion: input.promptVersion,
        contextHash: this.hash(this.stableStringify(input.contextForHash)),
        inputVersionRefsJson: (input.refs ?? {}) as Prisma.InputJsonValue,
        outputSchemaKey: input.outputSchemaKey ?? null,
        renderedPromptHash: this.hash(`${input.system}\n---\n${input.user}`),
      },
    });
    return id;
  }

  async startInvocation(input: StartInvocationInput): Promise<string> {
    const id = randomUUID();
    await this.prisma.llmInvocationRecord.create({
      data: {
        id,
        missionId: input.missionId,
        agentExecutionId: input.agentExecutionId ?? null,
        architectureReviewerExecutionId: input.architectureReviewerExecutionId ?? null,
        purpose: input.purpose,
        phase: input.phase ?? null,
        promptSnapshotId: input.promptSnapshotId ?? null,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    // CORE-006 §17: quando wired (EventsModule), todo início real de invocation vira um fato —
    // payload nunca carrega prompt/CoT, só ids/purpose (§18).
    if (this.eventLog) {
      await this.eventLog.append({
        missionId: input.missionId,
        correlationId: input.agentExecutionId ?? input.architectureReviewerExecutionId ?? input.missionId,
        actorType: 'LLM_GATEWAY',
        actorId: id,
        type: 'agent.llm_invocation_started',
        payload: { invocationId: id, agentExecutionId: input.agentExecutionId ?? null, purpose: input.purpose, promptSnapshotId: input.promptSnapshotId ?? null },
      });
    }
    return id;
  }

  async completeInvocation(invocationId: string, result: CompleteInvocationInput): Promise<void> {
    const row = await this.prisma.llmInvocationRecord.findUniqueOrThrow({ where: { id: invocationId } });
    const completedAt = new Date();
    await this.prisma.llmInvocationRecord.update({
      where: { id: invocationId },
      data: {
        status: 'SUCCEEDED',
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
        estimatedCost: result.estimatedCost ?? null,
        completedAt,
        latencyMs: completedAt.getTime() - row.startedAt.getTime(),
      },
    });
    if (this.eventLog) {
      await this.eventLog.append({
        missionId: row.missionId,
        correlationId: row.agentExecutionId ?? row.architectureReviewerExecutionId ?? row.missionId,
        actorType: 'LLM_GATEWAY',
        actorId: invocationId,
        type: 'agent.llm_invocation_completed',
        payload: { invocationId, agentExecutionId: row.agentExecutionId, purpose: row.purpose, provider: result.provider, model: result.model, tokensIn: result.inputTokens, tokensOut: result.outputTokens, latencyMs: completedAt.getTime() - row.startedAt.getTime(), status: 'SUCCEEDED' },
      });
    }
  }

  async failInvocation(invocationId: string, errorCode: string): Promise<void> {
    const row = await this.prisma.llmInvocationRecord.findUniqueOrThrow({ where: { id: invocationId } });
    const completedAt = new Date();
    await this.prisma.llmInvocationRecord.update({
      where: { id: invocationId },
      data: {
        status: 'FAILED',
        errorCode,
        completedAt,
        latencyMs: completedAt.getTime() - row.startedAt.getTime(),
      },
    });
    if (this.eventLog) {
      await this.eventLog.append({
        missionId: row.missionId,
        correlationId: row.agentExecutionId ?? row.architectureReviewerExecutionId ?? row.missionId,
        actorType: 'LLM_GATEWAY',
        actorId: invocationId,
        type: 'agent.llm_invocation_failed',
        payload: { invocationId, agentExecutionId: row.agentExecutionId, purpose: row.purpose, errorCode, latencyMs: completedAt.getTime() - row.startedAt.getTime(), status: 'FAILED' },
      });
    }
  }

  async countInvocations(agentExecutionId: string): Promise<number> {
    return this.prisma.llmInvocationRecord.count({ where: { agentExecutionId } });
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  private stableStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
