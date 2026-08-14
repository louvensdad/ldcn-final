import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { OverviewService } from '../overview/overview.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('OverviewService (Postgres)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let overview: OverviewService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    overview = new OverviewService(missionPersistence, new OperationPersistenceService(prisma), prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string) {
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  async function seedMission(missionId: string, rawUserIdea: string) {
    const session = await missionPersistence.hydrate(missionId);
    session.commands.generate({ missionId, rawUserIdea });
    await missionPersistence.flush(missionId, session);
  }

  it('listMissions() includes a freshly generated mission, most recent first', async () => {
    const missionId = `test-${randomUUID()}`;
    try {
      await seedMission(missionId, 'quero uma landing page');

      const summaries = await overview.listMissions();
      const found = summaries.find((summary) => summary.missionId === missionId);
      expect(found).toBeDefined();
      expect(found?.rawUserIdea).toBe('quero uma landing page');
      expect(found?.nextAction).toBe('START_EXECUTION');
      expect(found?.blockers).toEqual([]);
      expect(summaries[0].missionId).toBe(missionId);
    } finally {
      await cleanup(missionId);
    }
  });

  it('listMissions() respects the limit parameter', async () => {
    const missionIds = [`test-${randomUUID()}`, `test-${randomUUID()}`];
    try {
      for (const missionId of missionIds) await seedMission(missionId, 'quero uma landing page');
      const summaries = await overview.listMissions(1);
      expect(summaries).toHaveLength(1);
    } finally {
      for (const missionId of missionIds) await cleanup(missionId);
    }
  });

  it('getOverview() throws MISSION_NOT_FOUND for a mission that was never generated', async () => {
    await expect(overview.getOverview(`test-${randomUUID()}`)).rejects.toThrow('MISSION_NOT_FOUND');
  });
});
