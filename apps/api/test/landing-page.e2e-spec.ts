import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

/**
 * Full-stack regression for the doc 34 scenario (see core/src/__tests__/end-to-end-scenarios.test.ts,
 * "landing page is a constitutional executable mission"), replayed over real HTTP against real
 * Postgres: POST start -> GET overview must never come back READY_FOR_EXECUTION with zero
 * stacks/team/pipeline.
 */
(RUN_DB_TESTS ? describe : describe.skip)('Generator API — landing page (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let missionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
    await app.close();
  });

  it('produces a non-empty, READY_FOR_EXECUTION solution for "quero uma landing page"', async () => {
    missionId = `e2e-landing-${randomUUID()}`;

    const start = await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(201);

    expect(start.body.approvedSolution.deliveryTargets.some((t: { kind: string }) => t.kind === 'FRONTEND')).toBe(true);
    expect(start.body.approvedSolution.selectedStacks.length).toBeGreaterThan(0);
    expect(start.body.agentTeam.instances.length).toBeGreaterThan(0);
    expect(start.body.pipeline.nodes.length).toBeGreaterThan(0);
    expect(start.body.governance.allowed).toBe(true);

    const overview = await request(app.getHttpServer()).get(`/missions/${missionId}/intelligent-generator`).expect(200);
    expect(overview.body.status).toBe('READY_FOR_EXECUTION');
    expect(overview.body.approvedStackCount).toBeGreaterThan(0);
    expect(overview.body.pipelineNodeCount).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero um app totalmente diferente' })
      .expect(409);
  });

  it('rejects requests without the API key when LDCN_API_KEY is set', async () => {
    process.env.LDCN_API_KEY = 'test-key';
    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const guardedApp = moduleRef.createNestApplication();
      await guardedApp.init();
      await request(guardedApp.getHttpServer()).get(`/missions/${randomUUID()}/intelligent-generator`).expect(401);
      await request(guardedApp.getHttpServer()).get('/health').expect(200);
      await guardedApp.close();
    } finally {
      delete process.env.LDCN_API_KEY;
    }
  });
});
