import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { EventBusService } from '../events/event-bus.service';
import { GeneratorService } from '../generator/generator.service';
import { RepairPersistenceService } from '../repair/repair-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('RepairPersistenceService (Postgres)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let repair: RepairPersistenceService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    const generator = new GeneratorService(missionPersistence, new OperationPersistenceService(prisma), new EventBusService());
    repair = new RepairPersistenceService(prisma, missionPersistence, generator);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.failureSnapshot.deleteMany({ where: { missionId } });
    await prisma.repairAdvisory.deleteMany({ where: { missionId } });
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  async function seedMission(missionId: string, rawUserIdea: string) {
    const session = await missionPersistence.hydrate(missionId);
    const result = session.commands.generate({ missionId, rawUserIdea });
    await missionPersistence.flush(missionId, session);
    return result;
  }

  it('rejects classifyAndAdvise for a mission that was never generated', async () => {
    const missionId = `test-${randomUUID()}`;
    await expect(repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed' })).rejects.toThrow('MISSION_NOT_FOUND');
  });

  it('assessEligibility 404s when the task was never classified', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await expect(repair.assessEligibility(missionId, 'task-never-classified', {})).rejects.toThrow('RUNTIME_TASK_NOT_FOUND');
    } finally {
      await cleanup(missionId);
    }
  });

  it('classifyAndAdvise creates a snapshot and advisory, and is idempotent for the same input', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      const first = await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed with a TypeScript compile error' });
      expect(first.snapshot.category).toBe('BUILD');
      expect(first.advisory.failureCode).toBe(first.snapshot.failureCode);

      const second = await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed with a TypeScript compile error' });
      expect(second.snapshot.id).toBe(first.snapshot.id);
      expect(second.advisory.id).toBe(first.advisory.id);

      expect(await prisma.failureSnapshot.count({ where: { missionId, taskId: 'task-1' } })).toBe(1);
      expect(await prisma.repairAdvisory.count({ where: { missionId, taskId: 'task-1' } })).toBe(1);

      const executionFailedEvents = await prisma.decisionEvent.count({ where: { missionId, eventType: 'EXECUTION_FAILED' } });
      expect(executionFailedEvents).toBe(1);
    } finally {
      await cleanup(missionId);
    }
  });

  it('classifyAndAdvise creates a distinct snapshot for a different failure summary', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      const first = await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed' });
      const second = await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-2', summary: 'test suite failed with assertion errors' });
      expect(second.snapshot.id).not.toBe(first.snapshot.id);
      expect(second.snapshot.category).toBe('TEST');

      expect(await prisma.failureSnapshot.count({ where: { missionId, taskId: 'task-1' } })).toBe(2);
    } finally {
      await cleanup(missionId);
    }
  });

  it('a LOW-risk failure is eligible for repair without needing approval', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed' });

      const decision = await repair.assessEligibility(missionId, 'task-1', {});
      expect(decision.status).toBe('ELIGIBLE');
      expect(decision.requiresApproval).toBe(false);
    } finally {
      await cleanup(missionId);
    }
  });

  it('a CRITICAL-risk failure is blocked until approvalGranted is true', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      const { advisory } = await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'critical security vulnerability exposed in auth flow' });
      expect(advisory.risk).toBe('CRITICAL');

      const blocked = await repair.assessEligibility(missionId, 'task-1', {});
      expect(blocked.status).toBe('BLOCKED');
      expect(blocked.requiresApproval).toBe(true);

      const approved = await repair.assessEligibility(missionId, 'task-1', { approvalGranted: true });
      expect(approved.status).toBe('ELIGIBLE');

      const eligibilityEvents = await prisma.decisionEvent.count({ where: { missionId, eventType: 'REPAIR_ELIGIBILITY_EVALUATED' } });
      expect(eligibilityEvents).toBe(2);
    } finally {
      await cleanup(missionId);
    }
  });

  it('getOverview returns the latest snapshot and advisory for a task', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await repair.classifyAndAdvise(missionId, 'task-1', { executionId: 'exec-1', summary: 'build failed' });

      const overview = await repair.getOverview(missionId, 'task-1');
      expect(overview.snapshot?.category).toBe('BUILD');
      expect(overview.advisory?.likelySpecialistRole).toBeDefined();
    } finally {
      await cleanup(missionId);
    }
  });

  it('getOverview returns undefined fields for a task with no repair activity', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      const overview = await repair.getOverview(missionId, 'task-untouched');
      expect(overview.snapshot).toBeUndefined();
      expect(overview.advisory).toBeUndefined();
    } finally {
      await cleanup(missionId);
    }
  });
});
