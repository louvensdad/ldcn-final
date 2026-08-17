import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventLog, Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { EventBusService } from './event-bus.service';
import { LiveEventEnvelope, LiveEventType } from './live-event-envelope';

const FORBIDDEN_TERMS = ['apikey', 'api_key', 'secret', 'credential', 'password', 'bearer ', 'authorization'];
const MAX_SEQUENCE_RETRIES = 5;

export interface AppendEventInput {
  missionId: string;
  correlationId: string;
  causationId?: string;
  actorType: string;
  actorId?: string;
  type: LiveEventType | string;
  version?: number;
  payload: Record<string, unknown>;
  occurredAt?: Date;
  idempotencyKey?: string;
}

type TxClient = Prisma.TransactionClient;

/**
 * CORE-006 — EventLog append-only + EventBus publish. `DecisionEvent` (core/'s in-memory
 * event-sourcing store) e `AgentRuntimeTimelineEvent` (CORE-005, histórico de UMA execução) NÃO
 * são reaproveitados aqui — são outros conceitos, auditados e documentados como distintos.
 * EventLog nunca é source of truth: só registra que um fato do domínio real aconteceu.
 */
@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBusService) {}

  /** Caminho padrão: persiste (com sua própria transação curta) e SÓ DEPOIS publica no
   * EventBus — nunca o inverso (§8: persist first, publish second). */
  async append(input: AppendEventInput): Promise<LiveEventEnvelope> {
    this.assertSafePayload(input.payload);

    if (input.idempotencyKey) {
      const existing = await this.prisma.eventLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return this.toEnvelope(existing);
    }

    const row = await this.insertWithSequenceRetry(this.prisma, input);
    const envelope = this.toEnvelope(row);
    this.eventBus.emitEnvelope(envelope);
    return envelope;
  }

  /**
   * Para quando a mudança de domínio e o evento são o MESMO fato (§7) — ex.: AgentRuntime
   * transitando estado. O chamador já está dentro de um `prisma.$transaction(async (tx) => ...)`
   * e passa esse `tx` aqui; a linha do EventLog entra na MESMA transação curta (nunca span uma
   * chamada LLM). Retorna a linha crua — publicação só acontece depois, via `publish()`, quando
   * o chamador já sabe que a transação externa deu commit.
   */
  async appendWithinTransaction(tx: TxClient, input: AppendEventInput): Promise<EventLog> {
    this.assertSafePayload(input.payload);

    if (input.idempotencyKey) {
      const existing = await tx.eventLog.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }
    return this.insertWithSequenceRetry(tx, input);
  }

  /** Publica uma linha já persistida (commit já confirmado pelo chamador). */
  publish(row: EventLog): LiveEventEnvelope {
    const envelope = this.toEnvelope(row);
    this.eventBus.emitEnvelope(envelope);
    return envelope;
  }

  /** §10 — replay: cliente caiu, reconecta informando afterSequence, recebe só o que perdeu, em
   * ordem de sequence (nunca timestamp isolado). */
  async listMissionEvents(input: { missionId: string; afterSequence?: number; limit?: number }): Promise<LiveEventEnvelope[]> {
    const rows = await this.prisma.eventLog.findMany({
      where: { missionId: input.missionId, sequence: { gt: input.afterSequence ?? 0 } },
      orderBy: { sequence: 'asc' },
      take: input.limit ?? 500,
    });
    return rows.map((row) => this.toEnvelope(row));
  }

  /** §20 — read model mínimo, calculado sob demanda (nunca uma tabela própria de projeção nesta
   * CORE) a partir de estado canônico real (AgentInstance/AgentExecution/GenerationJob) +
   * agregados do ledger — nunca do EventLog como fonte de verdade. */
  async getMissionLiveStatus(missionId: string): Promise<{
    missionId: string;
    activeAgents: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    llmCalls: number;
    tokensIn: number;
    tokensOut: number;
    lastSequence: number;
  }> {
    const [activeAgents, runningJobs, completedJobs, failedJobs, invocations, lastEvent] = await Promise.all([
      this.prisma.agentInstance.count({ where: { missionId, state: { notIn: ['IDLE', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED'] } } }),
      this.prisma.generationJob.count({ where: { missionId, status: 'PENDING' } }),
      this.prisma.generationJob.count({ where: { missionId, status: { in: ['IMPLEMENTED', 'BUILD_TEST_VALIDATED'] } } }),
      this.prisma.generationJob.count({ where: { missionId, status: 'FAILED' } }),
      this.prisma.llmInvocationRecord.findMany({ where: { missionId } }),
      this.prisma.eventLog.findFirst({ where: { missionId }, orderBy: { sequence: 'desc' } }),
    ]);
    return {
      missionId,
      activeAgents,
      runningJobs,
      completedJobs,
      failedJobs,
      llmCalls: invocations.length,
      tokensIn: invocations.reduce((sum, i) => sum + (i.inputTokens ?? 0), 0),
      tokensOut: invocations.reduce((sum, i) => sum + (i.outputTokens ?? 0), 0),
      lastSequence: lastEvent?.sequence ?? 0,
    };
  }

  private async insertWithSequenceRetry(client: PrismaService | TxClient, input: AppendEventInput): Promise<EventLog> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt++) {
      const last = await client.eventLog.findFirst({ where: { missionId: input.missionId }, orderBy: { sequence: 'desc' } });
      const sequence = (last?.sequence ?? 0) + 1;
      try {
        return await client.eventLog.create({
          data: {
            id: randomUUID(),
            sequence,
            missionId: input.missionId,
            correlationId: input.correlationId,
            causationId: input.causationId ?? null,
            actorType: input.actorType,
            actorId: input.actorId ?? null,
            type: input.type,
            version: input.version ?? 1,
            payloadJson: input.payload as Prisma.InputJsonValue,
            occurredAt: input.occurredAt ?? new Date(),
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
      } catch (err) {
        // P2002 = unique constraint violation — race em (missionId, sequence) ou idempotencyKey;
        // retenta com a sequence recalculada. Qualquer outro erro propaga imediatamente.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('EVENT_LOG_SEQUENCE_CONFLICT');
  }

  private toEnvelope(row: EventLog): LiveEventEnvelope {
    return {
      id: row.id,
      sequence: row.sequence,
      missionId: row.missionId,
      correlationId: row.correlationId,
      causationId: row.causationId ?? undefined,
      type: row.type,
      version: row.version,
      actor: { type: row.actorType, id: row.actorId ?? undefined },
      occurredAt: row.occurredAt.toISOString(),
      payload: row.payloadJson,
    };
  }

  /** §18: nunca API key, token, credential, prompt bruto/CoT. Payloads desta CORE só carregam
   * ids/hashes/summaries/métricas — o scan é defesa ativa, não a única linha de defesa. */
  private assertSafePayload(payload: Record<string, unknown>): void {
    const text = JSON.stringify(payload).toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      if (text.includes(term)) throw new Error(`EVENT_LOG_CREDENTIAL_NOT_ALLOWED: forbidden term "${term.trim()}"`);
    }
  }
}
