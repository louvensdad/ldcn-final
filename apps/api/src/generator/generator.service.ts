import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryTargetKind, GeneratorDecisionEventType, IntelligentGeneratorQueryService } from 'ldcn-core';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';

export interface StartMissionInput {
  rawUserIdea: string;
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: DeliveryTargetKind[];
  constraints?: string[];
}

@Injectable()
export class GeneratorService {
  constructor(private readonly missionPersistence: MissionPersistenceService) {}

  async start(missionId: string, input: StartMissionInput) {
    if (!missionId?.trim()) throw new Error('MISSION_ID_REQUIRED');
    if (!input || typeof input.rawUserIdea !== 'string' || !input.rawUserIdea.trim()) throw new Error('INVALID_INTENT_INPUT');
    const session = await this.missionPersistence.hydrate(missionId);
    const result = session.commands.generate({ missionId, ...input });
    await this.missionPersistence.flush(missionId, session);
    return result;
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
