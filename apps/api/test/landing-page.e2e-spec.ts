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
 * stacks/team/pipeline. Also covers the doc 42 §3 Operation pattern (202 + operationId +
 * GET /operations/:id) and the composed MissionOverview read model (doc 36 §70).
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
    await prisma.operation.deleteMany({ where: { missionId } });
    await app.close();
  });

  it('produces a non-empty, READY_FOR_EXECUTION solution for "quero uma landing page"', async () => {
    missionId = `e2e-landing-${randomUUID()}`;

    const start = await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(202);
    expect(start.body).toMatchObject({ missionId, status: 'SUCCEEDED' });
    expect(typeof start.body.operationId).toBe('string');

    const operation = await request(app.getHttpServer()).get(`/operations/${start.body.operationId}`).expect(200);
    expect(operation.body.status).toBe('SUCCEEDED');
    const result = operation.body.resultJson;
    expect(result.approvedSolution.deliveryTargets.some((t: { kind: string }) => t.kind === 'FRONTEND')).toBe(true);
    expect(result.approvedSolution.selectedStacks.length).toBeGreaterThan(0);
    expect(result.agentTeam.instances.length).toBeGreaterThan(0);
    expect(result.pipeline.nodes.length).toBeGreaterThan(0);
    expect(result.governance.allowed).toBe(true);

    const overview = await request(app.getHttpServer()).get(`/missions/${missionId}/intelligent-generator`).expect(200);
    expect(overview.body.status).toBe('READY_FOR_EXECUTION');
    expect(overview.body.approvedStackCount).toBeGreaterThan(0);
    expect(overview.body.pipelineNodeCount).toBeGreaterThan(0);

    const missionOverview = await request(app.getHttpServer()).get(`/missions/${missionId}/overview`).expect(200);
    expect(missionOverview.body.solutionSummary.selectedStackCount).toBeGreaterThan(0);
    expect(missionOverview.body.teamSummary.instanceCount).toBeGreaterThan(0);
    expect(missionOverview.body.pipelineSummary.nodeCount).toBeGreaterThan(0);
    expect(missionOverview.body.nextAction).toBe('START_EXECUTION');
    expect(missionOverview.body.blockers).toEqual([]);
    expect(missionOverview.body.currentOperation.id).toBe(start.body.operationId);

    await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(202);

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
