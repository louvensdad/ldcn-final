import { Injectable, NotFoundException } from '@nestjs/common';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { PrismaService } from '../persistence/prisma.service';

export interface MissionSummaryDto {
  missionId: string;
  generatorState?: string;
  rawUserIdea: string;
  nextAction: string;
  blockers: string[];
  updatedAt: Date;
}

/**
 * doc 36 §70 (MissionOverviewReadModel), trimmed to what this system actually produces today.
 * taskSummary/artifactSummary/reviewSummary/gateSummary/aiUsageSummary/costSummary stay null:
 * execution runtime, artifacts, reviews/gates and AI usage tracking are not implemented yet
 * (see README "Fora de escopo").
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly missionPersistence: MissionPersistenceService,
    private readonly operations: OperationPersistenceService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * F1 - Workspace needs a way to enumerate missions; nothing exposed that before (every other
   * read endpoint takes a known missionId). GeneratorMissionState already has one row per
   * mission (written by MissionPersistenceService#flush on the success path of generate()), so
   * this is the natural source instead of a new table. Fine at dev/demo scale — no pagination
   * cursor yet, just a `take` limit.
   */
  async listMissions(limit = 50): Promise<MissionSummaryDto[]> {
    const states = await this.prisma.generatorMissionState.findMany({ orderBy: { updatedAt: 'desc' }, take: limit });
    const summaries = await Promise.all(
      states.map(async (state): Promise<MissionSummaryDto | undefined> => {
        try {
          const overview = await this.getOverview(state.missionId);
          return {
            missionId: state.missionId,
            generatorState: overview.generatorState,
            rawUserIdea: overview.intentSummary.rawUserIdea,
            nextAction: overview.nextAction,
            blockers: overview.blockers,
            updatedAt: state.updatedAt,
          };
        } catch {
          // A GeneratorMissionState row with no matching GenerationResult shouldn't happen
          // (both are written together in the same flush), but skip defensively rather than
          // fail the whole list over one inconsistent row.
          return undefined;
        }
      })
    );
    return summaries.filter((summary): summary is MissionSummaryDto => summary !== undefined);
  }

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
