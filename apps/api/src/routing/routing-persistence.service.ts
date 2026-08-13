import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DeliveryTargetKind,
  HandoffType,
  IntelligentWorkRouter,
  JobClassification,
  JobClassifier,
  TeamSwitchDecision,
  TeamSwitchResolver,
  WorkRoutingDecision,
} from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';

export interface ClassifyInput {
  description: string;
  affectedDomains?: string[];
  deliveryTarget?: DeliveryTargetKind;
  stackKey?: string;
}

export interface SwitchTeamInput {
  sourceTeamKey: string;
  targetTeamKey: string;
  handoffType: HandoffType;
  contractRefs: string[];
  artifactRefs?: string[];
  evidenceRefs?: string[];
  decisions?: string[];
  constraints?: string[];
  unresolvedDependencies?: string[];
  acceptanceCriteria?: string[];
}

/**
 * JobClassifier/IntelligentWorkRouter/TeamSwitchResolver keep their idempotency state in a
 * private in-memory Map with no injectable repository (unlike DecisionEventRepository etc.).
 * Since apps/api builds a fresh instance of each per request, that Map is always empty and
 * never actually prevents anything — the real idempotency boundary has to live here: compute
 * the (deterministic-except-for-id) result, compare its contextHash against whatever is
 * already persisted for that key, and replay the *same* conflict rules the core class would
 * have enforced (ROUTING_DECISION_STALE, TEAM_SWITCH_CONTEXT_STALE) instead of silently
 * overwriting or duplicating.
 */
@Injectable()
export class RoutingPersistenceService {
  constructor(private readonly prisma: PrismaService, private readonly missionPersistence: MissionPersistenceService) {}

  async classify(missionId: string, taskId: string, input: ClassifyInput): Promise<JobClassification> {
    const { approvedSolution } = await this.requireMissionResult(missionId);
    const fresh = new JobClassifier().classify({ missionId, taskId, ...input }, approvedSolution);

    const existing = await this.prisma.jobClassificationRecord.findUnique({ where: { contextKey: fresh.contextHash } });
    if (existing) return existing.detailJson as unknown as JobClassification;

    await this.prisma.jobClassificationRecord.create({
      data: { id: fresh.id, missionId, taskId, contextKey: fresh.contextHash, detailJson: fresh as unknown as Prisma.InputJsonValue },
    });
    return fresh;
  }

  async route(missionId: string, taskId: string): Promise<WorkRoutingDecision> {
    const { approvedSolution, agentTeam } = await this.requireMissionResult(missionId);
    const classification = await this.latestClassification(missionId, taskId);
    if (!classification) throw new Error('JOB_CLASSIFICATION_REQUIRED');

    const fresh = new IntelligentWorkRouter().route({ missionId, taskId, classification, approvedSolution, agentTeam });
    const routingKey = `${missionId}:${taskId}`;
    const existing = await this.prisma.workRoutingDecisionRecord.findUnique({ where: { routingKey } });
    if (existing) {
      const existingDecision = existing.detailJson as unknown as WorkRoutingDecision;
      if (existingDecision.contextHash === fresh.contextHash) return existingDecision;
      throw new Error('ROUTING_DECISION_STALE');
    }

    await this.prisma.workRoutingDecisionRecord.create({
      data: { id: fresh.id, missionId, taskId, routingKey, detailJson: fresh as unknown as Prisma.InputJsonValue },
    });
    return fresh;
  }

  async switchTeam(missionId: string, taskId: string, input: SwitchTeamInput): Promise<TeamSwitchDecision> {
    const { approvedSolution } = await this.requireMissionResult(missionId);
    const classification = await this.latestClassification(missionId, taskId);
    if (!classification) throw new Error('JOB_CLASSIFICATION_REQUIRED');

    const fresh = new TeamSwitchResolver().resolve({ missionId, taskId, approvedSolution, classification, ...input });
    const switchKey = `${missionId}:${taskId}:${input.sourceTeamKey}:${input.targetTeamKey}`;
    const existing = await this.prisma.teamSwitchDecisionRecord.findUnique({ where: { switchKey } });
    if (existing) {
      const existingDecision = existing.detailJson as unknown as TeamSwitchDecision;
      if (existingDecision.handoff.contextHash === fresh.handoff.contextHash) return existingDecision;
      throw new Error('TEAM_SWITCH_CONTEXT_STALE');
    }

    await this.prisma.teamSwitchDecisionRecord.create({
      data: { id: fresh.id, missionId, taskId, switchKey, detailJson: fresh as unknown as Prisma.InputJsonValue },
    });
    return fresh;
  }

  async getOverview(missionId: string, taskId: string) {
    const [classification, routing] = await Promise.all([this.latestClassification(missionId, taskId), this.getRouting(missionId, taskId)]);
    return { classification, routing };
  }

  async getHandoffs(missionId: string, taskId: string): Promise<TeamSwitchDecision[]> {
    const rows = await this.prisma.teamSwitchDecisionRecord.findMany({ where: { missionId, taskId }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => row.detailJson as unknown as TeamSwitchDecision);
  }

  private async getRouting(missionId: string, taskId: string): Promise<WorkRoutingDecision | undefined> {
    const row = await this.prisma.workRoutingDecisionRecord.findUnique({ where: { routingKey: `${missionId}:${taskId}` } });
    return row ? (row.detailJson as unknown as WorkRoutingDecision) : undefined;
  }

  private async latestClassification(missionId: string, taskId: string): Promise<JobClassification | undefined> {
    const row = await this.prisma.jobClassificationRecord.findFirst({ where: { missionId, taskId }, orderBy: { createdAt: 'desc' } });
    return row ? (row.detailJson as unknown as JobClassification) : undefined;
  }

  private async requireMissionResult(missionId: string) {
    const session = await this.missionPersistence.hydrate(missionId);
    const current = session.resultStore.getCurrent();
    if (!current) throw new NotFoundException('MISSION_NOT_FOUND');
    return current.result;
  }
}
