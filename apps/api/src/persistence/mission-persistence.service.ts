import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  GenerationResult as CoreGenerationResult,
  GeneratorDecisionEvent,
  GeneratorState,
  GeneratorStateMachine,
  IntelligentGeneratorCommandService,
  ReplanReason,
} from 'ldcn-core';
import { PrismaService } from './prisma.service';
import { HydratedDecisionEventStore } from './hydrated-decision-event-store';
import { HydratedGenerationResultStore } from './hydrated-generation-result-store';
import { HydratedGeneratorStateRepository } from './hydrated-generator-state-repository';

export interface MissionSession {
  commands: IntelligentGeneratorCommandService;
  eventStore: HydratedDecisionEventStore;
  resultStore: HydratedGenerationResultStore;
  stateRepository: HydratedGeneratorStateRepository;
}

/**
 * Bridges core's synchronous IntelligentGeneratorCommandService to Postgres: hydrate() loads a
 * mission's durable state into in-memory seeded stores before a command runs, flush() persists
 * whatever changed afterwards. See HydratedDecisionEventStore for why this shape exists instead
 * of a direct Prisma-backed DecisionEventRepository.
 */
@Injectable()
export class MissionPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async hydrate(missionId: string): Promise<MissionSession> {
    const [resultRow, stateRow, eventRows] = await Promise.all([
      this.prisma.generationResult.findUnique({ where: { missionId } }),
      this.prisma.generatorMissionState.findUnique({ where: { missionId } }),
      this.prisma.decisionEvent.findMany({ where: { missionId }, orderBy: { version: 'asc' } }),
    ]);

    const resultStore = new HydratedGenerationResultStore(
      resultRow ? { fingerprint: resultRow.fingerprint, result: this.reviveResult(resultRow.resultJson) } : undefined
    );
    const stateRepository = new HydratedGeneratorStateRepository(
      stateRow
        ? { missionId: stateRow.missionId, state: stateRow.state as GeneratorState, version: stateRow.version, lastReason: (stateRow.lastReason ?? undefined) as ReplanReason | undefined }
        : undefined
    );
    const eventStore = new HydratedDecisionEventStore(eventRows.map((row) => this.toDomainEvent(row)));

    const commands = new IntelligentGeneratorCommandService(undefined, eventStore, new GeneratorStateMachine(stateRepository), undefined, resultStore);
    return { commands, eventStore, resultStore, stateRepository };
  }

  async flush(missionId: string, session: MissionSession): Promise<void> {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    const newEvents = session.eventStore.getNewlyAppended();
    if (newEvents.length > 0) {
      operations.push(
        this.prisma.decisionEvent.createMany({
          data: newEvents.map((event) => ({
            id: event.id,
            missionId: event.missionId,
            version: event.version,
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            idempotencyKey: event.idempotencyKey,
            payload: event.payload,
            createdAt: new Date(event.createdAt),
          })),
          skipDuplicates: true,
        })
      );
    }

    if (session.resultStore.isDirty()) {
      const current = session.resultStore.getCurrent()!;
      const resultJson = JSON.parse(JSON.stringify(current.result));
      operations.push(
        this.prisma.generationResult.upsert({
          where: { missionId },
          create: { missionId, fingerprint: current.fingerprint, resultJson },
          update: { fingerprint: current.fingerprint, resultJson },
        })
      );
    }

    if (session.stateRepository.isDirty()) {
      const state = session.stateRepository.get()!;
      operations.push(
        this.prisma.generatorMissionState.upsert({
          where: { missionId },
          create: { missionId, state: state.state, version: state.version, lastReason: state.lastReason ?? null },
          update: { state: state.state, version: state.version, lastReason: state.lastReason ?? null },
        })
      );
    }

    if (operations.length > 0) await this.prisma.$transaction(operations);
  }

  private toDomainEvent(row: { id: string; missionId: string; version: number; eventType: string; aggregateType: string; aggregateId: string; idempotencyKey: string; payload: unknown; createdAt: Date }): GeneratorDecisionEvent {
    return {
      id: row.id,
      missionId: row.missionId,
      version: row.version,
      eventType: row.eventType as GeneratorDecisionEvent['eventType'],
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      idempotencyKey: row.idempotencyKey,
      payload: row.payload as Record<string, string | number | boolean | null>,
      createdAt: row.createdAt.getTime(),
    };
  }

  /** Mirrors JsonGenerationResultStore#revive (core/src/services/generation-result-store.ts): Dates survive JSON round-trips as strings. */
  private reviveResult(resultJson: unknown): CoreGenerationResult {
    const result = resultJson as CoreGenerationResult & { approvedSolution?: { approvedAt?: string | Date }; architectureComposition?: { approvedAt?: string | Date } };
    if (result.approvedSolution?.approvedAt && typeof result.approvedSolution.approvedAt === 'string') result.approvedSolution.approvedAt = new Date(result.approvedSolution.approvedAt);
    if (result.architectureComposition?.approvedAt && typeof result.architectureComposition.approvedAt === 'string') result.architectureComposition.approvedAt = new Date(result.architectureComposition.approvedAt);
    return result as CoreGenerationResult;
  }
}
