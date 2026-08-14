import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewGateEvaluation, ReviewGateEvaluator, ReviewGateEvidence, RuntimeAuditRecorder, WorkRoutingDecision } from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';

export interface EvaluateGatesInput {
  evidence: ReviewGateEvidence[];
}

/**
 * Same reasoning as RepairPersistenceService: no RuntimeLifecycleCoordinator (no
 * ExecutionRuntimePort to satisfy for something that never dispatches), ReviewGateEvaluator
 * called as a pure function, dedup replicated against Postgres by hand — mirrors the exact
 * idempotencyKey ReviewGateEvaluator itself would compute (`missionId:decisionId:evidenceHash`),
 * so a retried identical submission never double-counts.
 */
@Injectable()
export class GatePersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService
  ) {}

  async evaluate(missionId: string, taskId: string, input: EvaluateGatesInput): Promise<ReviewGateEvaluation> {
    const decision = await this.requireRoutingDecision(missionId, taskId);

    const evidenceHash = createHash('sha256').update(JSON.stringify(input.evidence)).digest('hex');
    const idempotencyKey = `${missionId}:${decision.id}:${evidenceHash}`;
    const existingRow = await this.prisma.reviewGateEvaluation.findUnique({ where: { idempotencyKey } });
    if (existingRow) return existingRow.detailJson as unknown as ReviewGateEvaluation;

    const evaluation = new ReviewGateEvaluator().evaluate(decision, input.evidence);

    await this.prisma.reviewGateEvaluation.create({
      data: { id: evaluation.id, missionId, taskId, idempotencyKey, detailJson: evaluation as unknown as Prisma.InputJsonValue },
    });

    const session = await this.missionPersistence.hydrate(missionId);
    const audit = new RuntimeAuditRecorder(session.eventStore);
    audit.recordGateEvaluation(evaluation);
    audit.recordReviewCompleted(evaluation);
    await this.missionPersistence.flush(missionId, session);

    return evaluation;
  }

  async getOverview(missionId: string, taskId: string): Promise<{ evaluation?: ReviewGateEvaluation }> {
    const row = await this.prisma.reviewGateEvaluation.findFirst({ where: { missionId, taskId }, orderBy: { createdAt: 'desc' } });
    return { evaluation: row ? (row.detailJson as unknown as ReviewGateEvaluation) : undefined };
  }

  private async requireRoutingDecision(missionId: string, taskId: string): Promise<WorkRoutingDecision> {
    const row = await this.prisma.workRoutingDecisionRecord.findUnique({ where: { routingKey: `${missionId}:${taskId}` } });
    if (!row) throw new NotFoundException('ROUTING_DECISION_REQUIRED');
    return row.detailJson as unknown as WorkRoutingDecision;
  }
}
