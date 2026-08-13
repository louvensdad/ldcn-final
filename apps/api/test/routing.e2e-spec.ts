import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('Routing API (e2e)', () => {
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
    await prisma.jobClassificationRecord.deleteMany({ where: { missionId } });
    await prisma.workRoutingDecisionRecord.deleteMany({ where: { missionId } });
    await prisma.teamSwitchDecisionRecord.deleteMany({ where: { missionId } });
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
    await app.close();
  });

  it('classifies, routes and switches a team for a task within a generated mission', async () => {
    missionId = `e2e-routing-${randomUUID()}`;
    const server = app.getHttpServer();

    await request(server)
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(201);

    const classify = await request(server)
      .post(`/missions/${missionId}/tasks/task-1/intelligent-routing/classify`)
      .send({ description: 'Implementar hero section com SEO' })
      .expect(201);
    expect(classify.body.taskId).toBe('task-1');

    const route = await request(server).post(`/missions/${missionId}/tasks/task-1/intelligent-routing/route`).expect(201);
    expect(route.body.taskId).toBe('task-1');
    expect(['ROUTED', 'BLOCKED_NO_REVIEWER', 'BLOCKED_CAPABILITY_GAP', 'BLOCKED_NO_EXECUTOR']).toContain(route.body.status);

    const routeAgain = await request(server).post(`/missions/${missionId}/tasks/task-1/intelligent-routing/route`).expect(201);
    expect(routeAgain.body.id).toBe(route.body.id);

    const overview = await request(server).get(`/missions/${missionId}/tasks/task-1/intelligent-routing`).expect(200);
    expect(overview.body.classification.id).toBe(classify.body.id);
    expect(overview.body.routing.id).toBe(route.body.id);
  });

  it('classify/route for a task in an unknown mission return 404', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post(`/missions/does-not-exist-${randomUUID()}/tasks/task-1/intelligent-routing/classify`)
      .send({ description: 'x' })
      .expect(404);
  });
});
