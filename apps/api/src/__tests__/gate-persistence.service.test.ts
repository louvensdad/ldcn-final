import { randomUUID } from 'node:crypto';
import { WorkRoutingDecision } from 'ldcn-core';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { GatePersistenceService } from '../gates/gate-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('GatePersistenceService (Postgres)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let gates: GatePersistenceService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    gates = new GatePersistenceService(prisma, missionPersistence);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.reviewGateEvaluation.deleteMany({ where: { missionId } });
    await prisma.workRoutingDecisionRecord.deleteMany({ where: { missionId } });
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
  }

  /** Seeds a WorkRoutingDecisionRecord row directly — reaching a real ROUTED status naturally requires a team with an eligible reviewer distinct from the executor, which isn't guaranteed by any fixture idea, so tests control this precondition directly instead of depending on team-composition luck. */
  async function seedRoutingDecision(missionId: string, taskId: string, overrides: Partial<WorkRoutingDecision> = {}): Promise<WorkRoutingDecision> {
    const decision: WorkRoutingDecision = {
      id: randomUUID(),
      missionId,
      version: 1,
      taskId,
      approvedSolutionId: 'sol-1',
      jobClassificationId: 'job-1',
      selectedTeamKey: 'stack.typescript.nextjs',
      executorAgentInstanceId: 'agent-executor-1',
      selectedAgentInstanceIds: ['agent-executor-1'],
      reviewerCandidateIds: ['agent-reviewer-1'],
      selectedReviewerIds: ['agent-reviewer-1'],
      requiredSpecialists: [],
      requiredCapabilityKeys: [],
      requiredGateKeys: ['review', 'quality'],
      routingSource: 'DETERMINISTIC',
      confidence: 1,
      rationale: 'test fixture',
      contextHash: randomUUID(),
      status: 'ROUTED',
      ...overrides,
    };
    await prisma.workRoutingDecisionRecord.create({
      data: { id: decision.id, missionId, taskId, routingKey: `${missionId}:${taskId}`, detailJson: decision as never },
    });
    return decision;
  }

  it('404s when no routing decision exists for the task', async () => {
    const missionId = `test-${randomUUID()}`;
    await expect(gates.evaluate(missionId, 'task-never-routed', { evidence: [] })).rejects.toThrow('ROUTING_DECISION_REQUIRED');
  });

  it('rejects evaluation when the routing decision is not ROUTED', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1', { status: 'BLOCKED_NO_REVIEWER', executorAgentInstanceId: undefined });
      await expect(gates.evaluate(missionId, 'task-1', { evidence: [] })).rejects.toThrow('REVIEW_ROUTING_NOT_READY');
    } finally {
      await cleanup(missionId);
    }
  });

  it('evaluates PASSED when every required gate has passing evidence', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1');
      const evaluation = await gates.evaluate(missionId, 'task-1', {
        evidence: [
          { gateKey: 'review', passed: true, evidenceRefs: ['pr-1'] },
          { gateKey: 'quality', passed: true, evidenceRefs: ['lint-report-1'] },
        ],
      });
      expect(evaluation.status).toBe('PASSED');

      const events = await prisma.decisionEvent.findMany({ where: { missionId, eventType: { in: ['GATE_EVALUATED', 'REVIEW_COMPLETED'] } } });
      expect(events).toHaveLength(2);
    } finally {
      await cleanup(missionId);
    }
  });

  it('evaluates FAILED when a required gate has failing evidence', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1');
      const evaluation = await gates.evaluate(missionId, 'task-1', {
        evidence: [
          { gateKey: 'review', passed: true, evidenceRefs: ['pr-1'] },
          { gateKey: 'quality', passed: false, evidenceRefs: ['lint-report-1'] },
        ],
      });
      expect(evaluation.status).toBe('FAILED');
      expect(evaluation.failedGateKeys).toEqual(['quality']);
    } finally {
      await cleanup(missionId);
    }
  });

  it('evaluates BLOCKED when a required gate is missing evidence entirely', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1');
      const evaluation = await gates.evaluate(missionId, 'task-1', {
        evidence: [{ gateKey: 'review', passed: true, evidenceRefs: ['pr-1'] }],
      });
      expect(evaluation.status).toBe('BLOCKED');
      expect(evaluation.missingGateKeys).toEqual(['quality']);
    } finally {
      await cleanup(missionId);
    }
  });

  it('is idempotent for the same evidence and returns the overview afterward', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1');
      const evidence = [
        { gateKey: 'review', passed: true, evidenceRefs: ['pr-1'] },
        { gateKey: 'quality', passed: true, evidenceRefs: ['lint-report-1'] },
      ];
      const first = await gates.evaluate(missionId, 'task-1', { evidence });
      const second = await gates.evaluate(missionId, 'task-1', { evidence });
      expect(second.id).toBe(first.id);

      const rows = await prisma.reviewGateEvaluation.count({ where: { missionId, taskId: 'task-1' } });
      expect(rows).toBe(1);

      const overview = await gates.getOverview(missionId, 'task-1');
      expect(overview.evaluation?.id).toBe(first.id);
    } finally {
      await cleanup(missionId);
    }
  });

  it('getOverview returns undefined when no evaluation exists yet', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedRoutingDecision(missionId, 'task-1');
      const overview = await gates.getOverview(missionId, 'task-1');
      expect(overview.evaluation).toBeUndefined();
    } finally {
      await cleanup(missionId);
    }
  });
});
