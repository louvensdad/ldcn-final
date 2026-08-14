import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FailureClassifier,
  FailureSnapshot,
  RepairAdvisor,
  RepairAdvisory,
  RepairEligibilityDecision,
  RepairEligibilityPolicy,
  RuntimeAuditRecorder,
} from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { GeneratorService } from '../generator/generator.service';

export interface ClassifyFailureInput {
  executionId: string;
  summary: string;
  evidenceRefs?: string[];
  affectedStack?: string;
  failedGateKey?: string;
}

export interface AssessEligibilityInput {
  approvalGranted?: boolean;
  maxAttempts?: number;
}

/**
 * FailureClassifier/RepairAdvisor/RepairEligibilityPolicy keep idempotency in a private
 * in-memory Map with no injectable repository, same situation RoutingPersistenceService already
 * solved for JobClassifier/IntelligentWorkRouter (see that file's doc comment) — compute the
 * fresh result as a pure function, then dedupe/persist against Postgres by hand here.
 *
 * Deliberately does NOT use RuntimeLifecycleCoordinator: it requires an ExecutionRuntimePort in
 * its constructor, and no real execution runtime exists yet (generate() has no execution I/O) —
 * wiring one just to satisfy the constructor, never calling dispatch(), would be worse than
 * calling FailureClassifier/RepairAdvisor/RepairEligibilityPolicy directly, which need no port.
 */
@Injectable()
export class RepairPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missionPersistence: MissionPersistenceService,
    private readonly generator: GeneratorService
  ) {}

  /**
   * Classifying a failure presupposes an execution happened and failed — that's the domain
   * meaning of "failure classification", not a fabricated fact. Since nothing else in this
   * system ever emits EXECUTION_FAILED (no real runtime reports status yet), recording it here
   * is what makes RepairEligibilityPolicy's "requires a failed execution" check reachable at
   * all, instead of permanently blocked for a reason unrelated to approval.
   */
  async classifyAndAdvise(missionId: string, taskId: string, input: ClassifyFailureInput): Promise<{ snapshot: FailureSnapshot; advisory: RepairAdvisory }> {
    const result = await this.requireMissionResult(missionId);

    const freshSnapshot = new FailureClassifier().classify({ missionId, taskId, ...input });
    const existingSnapshotRow = await this.prisma.failureSnapshot.findUnique({ where: { contextHash: freshSnapshot.contextHash } });
    const snapshotIsNew = !existingSnapshotRow;
    const snapshot = existingSnapshotRow ? (existingSnapshotRow.detailJson as unknown as FailureSnapshot) : freshSnapshot;
    if (snapshotIsNew) {
      await this.prisma.failureSnapshot.create({
        data: { id: snapshot.id, missionId, version: snapshot.version, taskId, contextHash: snapshot.contextHash, detailJson: snapshot as unknown as Prisma.InputJsonValue },
      });
    }

    const freshAdvisory = new RepairAdvisor().adviseSnapshot({ missionId, approvedSolutionId: result.approvedSolution.id, snapshot });
    const existingAdvisoryRow = await this.prisma.repairAdvisory.findUnique({ where: { contextHash: freshAdvisory.contextHash } });
    const advisoryIsNew = !existingAdvisoryRow;
    const advisory = existingAdvisoryRow ? (existingAdvisoryRow.detailJson as unknown as RepairAdvisory) : freshAdvisory;
    if (advisoryIsNew) {
      await this.prisma.repairAdvisory.create({
        data: { id: advisory.id, missionId, version: advisory.version, taskId, contextHash: advisory.contextHash, detailJson: advisory as unknown as Prisma.InputJsonValue },
      });
    }

    if (snapshotIsNew || advisoryIsNew) {
      const session = await this.missionPersistence.hydrate(missionId);
      const audit = new RuntimeAuditRecorder(session.eventStore);
      if (snapshotIsNew) {
        audit.recordExecutionOutcome({ missionId, taskId, executionId: input.executionId, success: false, evidenceRefs: input.evidenceRefs });
        audit.recordFailureClassification(snapshot);
      }
      if (advisoryIsNew) audit.recordRepairAdvisory(advisory);
      await this.missionPersistence.flush(missionId, session);
    }

    return { snapshot, advisory };
  }

  /**
   * The human-in-the-loop approval hook: call with { approvalGranted: true } once a CRITICAL-risk
   * advisory has been reviewed. `risk` always comes from the stored advisory, never from the
   * request body — RepairAdvisor.advise() already computes it deterministically from the failure
   * text, and trusting a caller-supplied risk would let a client bypass the approval requirement.
   */
  async assessEligibility(missionId: string, taskId: string, input: AssessEligibilityInput): Promise<RepairEligibilityDecision> {
    const queries = await this.generator.queries(missionId);
    const overview = queries.getRuntimeTaskOverview(missionId, taskId);
    if (!overview) throw new NotFoundException('RUNTIME_TASK_NOT_FOUND');

    const advisory = await this.latestAdvisory(missionId, taskId);
    if (!advisory) throw new NotFoundException('REPAIR_ADVISORY_REQUIRED');

    const decision = new RepairEligibilityPolicy().evaluate({
      missionId,
      overview,
      risk: advisory.risk,
      maxAttempts: input.maxAttempts,
      approvalGranted: input.approvalGranted,
    });

    const session = await this.missionPersistence.hydrate(missionId);
    const audit = new RuntimeAuditRecorder(session.eventStore);
    audit.recordRepairEligibility(decision);
    await this.missionPersistence.flush(missionId, session);

    return decision;
  }

  async getOverview(missionId: string, taskId: string): Promise<{ snapshot?: FailureSnapshot; advisory?: RepairAdvisory }> {
    const [snapshot, advisory] = await Promise.all([this.latestSnapshot(missionId, taskId), this.latestAdvisory(missionId, taskId)]);
    return { snapshot, advisory };
  }

  private async latestSnapshot(missionId: string, taskId: string): Promise<FailureSnapshot | undefined> {
    const row = await this.prisma.failureSnapshot.findFirst({ where: { missionId, taskId }, orderBy: { createdAt: 'desc' } });
    return row ? (row.detailJson as unknown as FailureSnapshot) : undefined;
  }

  private async latestAdvisory(missionId: string, taskId: string): Promise<RepairAdvisory | undefined> {
    const row = await this.prisma.repairAdvisory.findFirst({ where: { missionId, taskId }, orderBy: { createdAt: 'desc' } });
    return row ? (row.detailJson as unknown as RepairAdvisory) : undefined;
  }

  private async requireMissionResult(missionId: string) {
    const session = await this.missionPersistence.hydrate(missionId);
    const current = session.resultStore.getCurrent();
    if (!current) throw new NotFoundException('MISSION_NOT_FOUND');
    return current.result;
  }
}
