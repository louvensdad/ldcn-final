import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

/**
 * Runs against the Postgres started by infra/docker-compose.yml. Skips automatically when no
 * DATABASE_URL is configured (e.g. a plain `npm test` without the DB up), so this suite never
 * blocks unrelated work — the same tradeoff core/ makes for its Json*Store tests running
 * against the filesystem instead of a mock.
 */
(RUN_DB_TESTS ? describe : describe.skip)('MissionPersistenceService (Postgres)', () => {
  let prisma: PrismaService;
  let service: MissionPersistenceService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new MissionPersistenceService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  it('hydrates an empty session for an unknown mission', async () => {
    const missionId = `test-${randomUUID()}`;
    const session = await service.hydrate(missionId);
    expect(session.resultStore.getCurrent()).toBeUndefined();
    expect(session.stateRepository.get()).toBeUndefined();
    expect(session.eventStore.list(missionId)).toHaveLength(0);
    await cleanup(missionId);
  });

  it('flush persists new decision events, the generation result and the mission state; a later hydrate sees them', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const session = await service.hydrate(missionId);
      const result = session.commands.generate({ missionId, rawUserIdea: 'quero uma landing page' });
      expect(session.eventStore.getNewlyAppended().length).toBeGreaterThan(0);
      expect(session.resultStore.isDirty()).toBe(true);
      expect(session.stateRepository.isDirty()).toBe(true);

      await service.flush(missionId, session);

      const rehydrated = await service.hydrate(missionId);
      expect(rehydrated.resultStore.getCurrent()?.result.approvedSolution.id).toBe(result.approvedSolution.id);
      expect(rehydrated.stateRepository.get()?.state).toBe('READY_FOR_EXECUTION');
      expect(rehydrated.eventStore.list(missionId).length).toBe(session.eventStore.list(missionId).length);
      expect(rehydrated.eventStore.getNewlyAppended()).toHaveLength(0);
    } finally {
      await cleanup(missionId);
    }
  });

  it('a rehydrated session is idempotent: re-running generate() with the same input returns the persisted result and appends nothing new', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const first = await service.hydrate(missionId);
      const firstResult = first.commands.generate({ missionId, rawUserIdea: 'quero uma landing page' });
      await service.flush(missionId, first);

      const second = await service.hydrate(missionId);
      const secondResult = second.commands.generate({ missionId, rawUserIdea: 'quero uma landing page' });
      await service.flush(missionId, second);

      expect(secondResult.approvedSolution.id).toBe(firstResult.approvedSolution.id);
      expect(second.eventStore.getNewlyAppended()).toHaveLength(0);
    } finally {
      await cleanup(missionId);
    }
  });

  it('a rehydrated session rejects a divergent command for the same mission with GENERATOR_COMMAND_CONFLICT', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      const first = await service.hydrate(missionId);
      first.commands.generate({ missionId, rawUserIdea: 'quero uma landing page' });
      await service.flush(missionId, first);

      const second = await service.hydrate(missionId);
      expect(() => second.commands.generate({ missionId, rawUserIdea: 'quero uma API REST' })).toThrow('GENERATOR_COMMAND_CONFLICT');
    } finally {
      await cleanup(missionId);
    }
  });
});
