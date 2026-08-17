import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

/** doc 42 §4 / doc 36 §67: GET /stream must push operation.started/operation.completed as the mission is generated. */
(RUN_DB_TESTS ? describe : describe.skip)('SSE stream (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let missionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.decisionEvent.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
    await prisma.operation.deleteMany({ where: { missionId } });
    await app.close();
  });

  it('pushes operation.started and operation.completed while a mission is generated', async () => {
    missionId = `e2e-sse-${randomUUID()}`;

    const received: string[] = [];
    const streamReq = http.get(`${baseUrl}/stream?apiKey=${encodeURIComponent(process.env.LDCN_API_KEY ?? '')}`, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => received.push(chunk));
    });
    // Give the SSE connection a moment to attach before triggering the events it should observe.
    await new Promise((resolve) => setTimeout(resolve, 100));

    await request(app.getHttpServer())
      .post(`/missions/${missionId}/intelligent-generator/start`)
      .set('x-api-key', process.env.LDCN_API_KEY ?? '')
      .send({ rawUserIdea: 'quero uma landing page' })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 200));
    streamReq.destroy();

    const body = received.join('');
    expect(body).toContain('event: operation.started');
    expect(body).toContain('event: operation.completed');
    expect(body).toContain(missionId);
  });
});
