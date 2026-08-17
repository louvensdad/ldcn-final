import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryTargetKind, GenerationReuseScope, GeneratorDecisionEventType, IntelligentGeneratorQueryService } from 'ldcn-core';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { EventBusService } from '../events/event-bus.service';

export interface StartMissionInput {
  rawUserIdea: string;
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: DeliveryTargetKind[];
  constraints?: string[];
}

export interface StartMissionAccepted {
  operationId: string;
  missionId: string;
  status: 'SUCCEEDED' | 'FAILED';
}

/** MISSÃO "Targeted Generation" — o mesmo `StartMissionAccepted`, mais o que realmente foi
 * reaproveitado vs recomputado (nunca inferido depois — sempre o registro real do Generator). */
export interface StartTargetedMissionAccepted extends StartMissionAccepted {
  actualReuse: GenerationReuseScope;
  escalations: { stage: string; reason: string }[];
}

@Injectable()
export class GeneratorService {
  constructor(
    private readonly missionPersistence: MissionPersistenceService,
    private readonly operations: OperationPersistenceService,
    private readonly eventBus: EventBusService
  ) {}

  /**
   * doc 42 §3 (Operation pattern): the caller gets an operationId back and follows up via
   * GET /operations/:id or the SSE stream, instead of the full GenerationResult inline.
   *
   * Today generate() has no LLM/execution I/O, so it's still fast enough to run inside this
   * same request — there's no real latency to hide yet. What matters now is establishing the
   * *contract* (operationId, Operation record, operation.* events) so nothing has to change on
   * the client when a genuinely slow, detached execution path lands in a later slice. Errors
   * (including GENERATOR_COMMAND_CONFLICT) still surface as an immediate 4xx via
   * DomainErrorFilter, not as a silently-failed Operation the caller has to poll for.
   */
  async start(missionId: string, input: StartMissionInput): Promise<StartMissionAccepted> {
    if (!missionId?.trim()) throw new Error('MISSION_ID_REQUIRED');
    if (!input || typeof input.rawUserIdea !== 'string' || !input.rawUserIdea.trim()) throw new Error('INVALID_INTENT_INPUT');

    const correlationId = randomUUID();
    const operation = await this.operations.create(missionId, 'GENERATE_MISSION', correlationId);
    this.eventBus.emit('operation.started', { type: 'GENERATE_MISSION' }, { missionId, operationId: operation.id });

    try {
      const session = await this.missionPersistence.hydrate(missionId);
      const result = session.commands.generate({ missionId, ...input });
      await this.missionPersistence.flush(missionId, session);
      await this.operations.succeed(operation.id, result);

      this.eventBus.emit('operation.completed', { approvedSolutionId: result.approvedSolution.id }, { missionId, operationId: operation.id });
      this.eventBus.emit('mission.state.changed', { allowed: result.governance.allowed }, { missionId, operationId: operation.id });
      this.eventBus.emit('team.composed', { teamId: result.agentTeam.id, instanceCount: result.agentTeam.instances.length }, { missionId, operationId: operation.id });
      this.eventBus.emit('pipeline.updated', { pipelineId: result.pipeline.id, nodeCount: result.pipeline.nodes.length }, { missionId, operationId: operation.id });

      return { operationId: operation.id, missionId, status: 'SUCCEEDED' };
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'INTERNAL_ERROR';
      await this.operations.fail(operation.id, errorCode);
      this.eventBus.emit('operation.failed', { errorCode }, { missionId, operationId: operation.id });
      throw error;
    }
  }

  /**
   * MISSÃO "Targeted Generation no Marketplace" — mesmo Operation pattern e mesmos eventos de
   * `start()` (nunca um caminho paralelo de verdade); a única diferença real é chamar
   * `generateTargeted` em vez de `generate`, reaproveitando as decisões já governadas da mission
   * de referência quando o `scope` permitir. `referenceMissionId` precisa ter um GenerationResult
   * real e persistido — a mesma exigência que `MarketplaceSolutionService.createVersionFromMission`
   * já faz.
   */
  async startTargeted(missionId: string, input: StartMissionInput, referenceMissionId: string, scope: GenerationReuseScope): Promise<StartTargetedMissionAccepted> {
    if (!missionId?.trim()) throw new Error('MISSION_ID_REQUIRED');
    if (!input || typeof input.rawUserIdea !== 'string' || !input.rawUserIdea.trim()) throw new Error('INVALID_INTENT_INPUT');

    const referenceSession = await this.missionPersistence.hydrate(referenceMissionId);
    const referenceStored = referenceSession.resultStore.getCurrent();
    if (!referenceStored) throw new Error('MARKETPLACE_REFERENCE_MISSION_NOT_GENERATED');

    const correlationId = randomUUID();
    const operation = await this.operations.create(missionId, 'GENERATE_MISSION', correlationId);
    this.eventBus.emit('operation.started', { type: 'GENERATE_MISSION' }, { missionId, operationId: operation.id });

    try {
      const session = await this.missionPersistence.hydrate(missionId);
      const result = session.commands.generateTargeted({ missionId, ...input }, referenceStored.result, scope);
      await this.missionPersistence.flush(missionId, session);
      await this.operations.succeed(operation.id, result);

      this.eventBus.emit('operation.completed', { approvedSolutionId: result.approvedSolution.id }, { missionId, operationId: operation.id });
      this.eventBus.emit('mission.state.changed', { allowed: result.governance.allowed }, { missionId, operationId: operation.id });
      this.eventBus.emit('team.composed', { teamId: result.agentTeam.id, instanceCount: result.agentTeam.instances.length }, { missionId, operationId: operation.id });
      this.eventBus.emit('pipeline.updated', { pipelineId: result.pipeline.id, nodeCount: result.pipeline.nodes.length }, { missionId, operationId: operation.id });

      return { operationId: operation.id, missionId, status: 'SUCCEEDED', actualReuse: result.actualReuse, escalations: result.escalations };
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'INTERNAL_ERROR';
      await this.operations.fail(operation.id, errorCode);
      this.eventBus.emit('operation.failed', { errorCode }, { missionId, operationId: operation.id });
      throw error;
    }
  }

  async getEvents(missionId: string) {
    const session = await this.missionPersistence.hydrate(missionId);
    return session.eventStore.list(missionId);
  }

  async getEventsByType(missionId: string, eventType: GeneratorDecisionEventType) {
    const session = await this.missionPersistence.hydrate(missionId);
    return session.eventStore.listByType(missionId, eventType);
  }

  /** Every GET read shares this: hydrate a fresh session and reconstruct the query service the same way core's HTTP/local adapters already do. */
  async queries(missionId: string): Promise<IntelligentGeneratorQueryService> {
    const session = await this.missionPersistence.hydrate(missionId);
    session.commands.restore(missionId);
    return session.commands.createQueryService();
  }

  private async requireQueries(missionId: string): Promise<IntelligentGeneratorQueryService> {
    const queries = await this.queries(missionId);
    if (!queries.getGeneratorOverview(missionId)) throw new NotFoundException('MISSION_NOT_FOUND');
    return queries;
  }

  async getOverview(missionId: string) {
    return (await this.requireQueries(missionId)).getGeneratorOverview(missionId);
  }

  async getIntent(missionId: string) {
    return (await this.requireQueries(missionId)).getCurrentIntent(missionId);
  }

  async getRequirements(missionId: string) {
    return (await this.requireQueries(missionId)).getRequirements(missionId);
  }

  async getTopology(missionId: string) {
    return (await this.requireQueries(missionId)).getTopology(missionId);
  }

  async getSolutionProposal(missionId: string) {
    return (await this.requireQueries(missionId)).getSolutionProposal(missionId);
  }

  async getStackCandidates(missionId: string) {
    return (await this.requireQueries(missionId)).getStackCandidates(missionId);
  }

  async getArchitectureDecisions(missionId: string) {
    return (await this.requireQueries(missionId)).getArchitecture(missionId);
  }

  async getTeam(missionId: string) {
    return (await this.requireQueries(missionId)).getTeamComposition(missionId);
  }

  async getPipeline(missionId: string) {
    return (await this.requireQueries(missionId)).getPipeline(missionId);
  }

  async getLearningSignals(missionId: string) {
    return (await this.queries(missionId)).getLearningSignals(missionId);
  }
}
