import { Injectable, NotFoundException } from '@nestjs/common';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';

/**
 * doc 36 §70 (MissionOverviewReadModel), trimmed to what this system actually produces today.
 * taskSummary/artifactSummary/reviewSummary/gateSummary/aiUsageSummary/costSummary stay null:
 * execution runtime, artifacts, reviews/gates and AI usage tracking are not implemented yet
 * (see README "Fora de escopo").
 */
@Injectable()
export class OverviewService {
  constructor(private readonly missionPersistence: MissionPersistenceService, private readonly operations: OperationPersistenceService) {}

  async getOverview(missionId: string) {
    const session = await this.missionPersistence.hydrate(missionId);
    const stored = session.resultStore.getCurrent();
    if (!stored) throw new NotFoundException('MISSION_NOT_FOUND');
    const result = stored.result;

    session.commands.restore(missionId);
    const generatorOverview = session.commands.createQueryService().getGeneratorOverview(missionId);
    const currentOperation = await this.operations.latest(missionId);

    return {
      missionId,
      generatorState: session.stateRepository.get()?.state,
      currentOperation,
      intentSummary: {
        rawUserIdea: result.intent.rawUserIdea,
        problemStatement: result.intent.problemStatement,
        confidence: result.intent.confidence.value,
        status: result.intent.status,
      },
      requirementsSummary: { itemCount: result.contract.items.length, status: result.contract.status },
      topologySummary: {
        requiredTargets: result.topology.deliveryTargets.filter((target) => target.required).map((target) => target.kind),
        status: result.topology.status,
      },
      solutionSummary: {
        selectedStackCount: result.approvedSolution.selectedStacks.length,
        deliveryTargetCount: result.approvedSolution.deliveryTargets.length,
        status: result.approvedSolution.status,
      },
      architectureSummary: {
        proposalCount: result.architectureComposition.proposals.length,
        conflictCount: result.architectureComposition.conflicts.length,
        status: result.architectureComposition.status,
      },
      teamSummary: { instanceCount: result.agentTeam.instances.length, status: result.agentTeam.status },
      pipelineSummary: {
        nodeCount: result.pipeline.nodes.length,
        blockedNodeCount: result.pipeline.nodes.filter((node) => node.state === 'BLOCKED_UNSUPPORTED_RUNTIME').length,
        status: result.pipeline.status,
      },
      taskSummary: null,
      artifactSummary: null,
      reviewSummary: null,
      gateSummary: null,
      aiUsageSummary: null,
      costSummary: null,
      nextAction: generatorOverview?.nextAction ?? 'NONE',
      blockers: result.governance.errors,
    };
  }
}
