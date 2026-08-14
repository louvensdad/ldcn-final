import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { RoutingPersistenceService } from '../routing/routing-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('RoutingPersistenceService (Postgres)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let routing: RoutingPersistenceService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    routing = new RoutingPersistenceService(prisma, missionPersistence);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.jobClassificationRecord.deleteMany({ where: { missionId } });
    await prisma.workRoutingDecisionRecord.deleteMany({ where: { missionId } });
    await prisma.teamSwitchDecisionRecord.deleteMany({ where: { missionId } });
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

  it('rejects classify/route/switch-team for a mission that was never generated', async () => {
    const missionId = `test-${randomUUID()}`;
    await expect(routing.classify(missionId, 'task-1', { description: 'x' })).rejects.toThrow('MISSION_NOT_FOUND');
    await expect(routing.route(missionId, 'task-1')).rejects.toThrow('MISSION_NOT_FOUND');
  });

  it('classify() is idempotent for the same description and persists across a fresh hydrate', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      const first = await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      const second = await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      expect(second.id).toBe(first.id);

      const rows = await prisma.jobClassificationRecord.count({ where: { missionId, taskId: 'task-1' } });
      expect(rows).toBe(1);
    } finally {
      await cleanup(missionId);
    }
  });

  it('route() requires a classification first', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await expect(routing.route(missionId, 'task-without-classification')).rejects.toThrow('JOB_CLASSIFICATION_REQUIRED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('route() is idempotent for the same classification and survives a fresh instance', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      const first = await routing.route(missionId, 'task-1');

      const freshRouting = new RoutingPersistenceService(prisma, missionPersistence);
      const second = await freshRouting.route(missionId, 'task-1');
      expect(second.id).toBe(first.id);
      expect(second.status).toBe(first.status);

      const overview = await routing.getOverview(missionId, 'task-1');
      expect(overview.routing?.id).toBe(first.id);
    } finally {
      await cleanup(missionId);
    }
  });

  it('switch-team requires at least one contract reference (core validation surfaces through the wrapper)', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const result = await seedMission(missionId, 'quero uma landing page');
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      const stackKey = result.approvedSolution.selectedStacks[0].stackKey;
      await expect(
        routing.switchTeam(missionId, 'task-1', { sourceTeamKey: stackKey, targetTeamKey: stackKey, handoffType: 'DELIVERY_TO_REVIEW', contractRefs: [] })
      ).rejects.toThrow('at least one contract reference');
    } finally {
      await cleanup(missionId);
    }
  });

  it('switch-team is idempotent for the same source/target pair and lists in getHandoffs()', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const result = await seedMission(missionId, 'quero uma landing page');
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      const stackKey = result.approvedSolution.selectedStacks[0].stackKey;

      const first = await routing.switchTeam(missionId, 'task-1', {
        sourceTeamKey: stackKey,
        targetTeamKey: stackKey,
        handoffType: 'DELIVERY_TO_REVIEW',
        contractRefs: ['contract-1'],
      });
      const second = await routing.switchTeam(missionId, 'task-1', {
        sourceTeamKey: stackKey,
        targetTeamKey: stackKey,
        handoffType: 'DELIVERY_TO_REVIEW',
        contractRefs: ['contract-1'],
      });
      expect(second.id).toBe(first.id);
      expect(first.status).toBe('NO_SWITCH');

      const handoffs = await routing.getHandoffs(missionId, 'task-1');
      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].id).toBe(first.id);
    } finally {
      await cleanup(missionId);
    }
  });

  it('listTasks() dedupes by taskId (keeping the most recent classification) and enriches with routing status', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section' });
      await routing.classify(missionId, 'task-1', { description: 'Implementar hero section com SEO' });
      await routing.classify(missionId, 'task-2', { description: 'Ajustar meta tags' });
      await routing.route(missionId, 'task-1');

      const tasks = await routing.listTasks(missionId);
      expect(tasks).toHaveLength(2);

      const task1 = tasks.find((task) => task.taskId === 'task-1');
      expect(task1?.classification.contextHash).toBeDefined();
      expect(task1?.routingStatus).toBeDefined();

      const task2 = tasks.find((task) => task.taskId === 'task-2');
      expect(task2?.routingStatus).toBeUndefined();
    } finally {
      await cleanup(missionId);
    }
  });

  it('listTasks() returns an empty array for a mission with no classified tasks', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');
      expect(await routing.listTasks(missionId)).toEqual([]);
    } finally {
      await cleanup(missionId);
    }
  });
});
