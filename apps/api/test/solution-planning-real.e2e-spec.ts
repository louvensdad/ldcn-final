import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';
import { RequirementBaselineService } from '../src/requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../src/requirements/scope-coverage.service';

const RUN = !!(process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL) && process.env.LDCN_E2E_REAL_AI === '1';

(RUN ? describe : describe.skip)('CORE-012 real provider solution planning (optional e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baselines: RequirementBaselineService;
  let scope: ScopeCoverageService;
  const missionId = `e2e-core012-real-${randomUUID()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    baselines = app.get(RequirementBaselineService);
    scope = app.get(ScopeCoverageService);
  });

  afterAll(async () => {
    await prisma.approvedSolution.deleteMany({ where: { missionId } });
    await prisma.scopeCoverageDecision.deleteMany({ where: { missionId } });
    await prisma.requirementBaseline.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.agentExecution.deleteMany({ where: { missionId } });
    await prisma.eventLog.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await app.close();
  });

  it('executes the real endpoint/provider and approves a catalog-valid solution', async () => {
    await prisma.requirement.createMany({ data: [
      { id: randomUUID(), missionId, section: 'features', content: 'API para cadastrar clientes', origin: 'USER', status: 'CONFIRMED', createdBy: 'user', requirementKey: 'REQ-001', category: 'FUNCTIONAL', source: 'USER_EXPLICIT' },
      { id: randomUUID(), missionId, section: 'nonFunctional', content: 'Todas as alterações devem ser auditáveis', origin: 'USER', status: 'CONFIRMED', createdBy: 'user', requirementKey: 'REQ-002', category: 'NON_FUNCTIONAL', source: 'USER_EXPLICIT' },
    ] });
    const baseline = await baselines.createBaseline(missionId);
    for (const ref of baseline.requirementRefs) await scope.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    await baselines.finalizeBaseline(missionId, baseline.id);
    await scope.finalizeCoverage(missionId, baseline.id);

    const response = await request(app.getHttpServer())
      .post(`/missions/${missionId}/solution-planning/start`)
      .set('x-api-key', process.env.LDCN_API_KEY ?? '')
      .send({ requirementBaselineId: baseline.id })
      .expect(201);
    expect(response.body).toMatchObject({ missionId, status: 'APPROVED', requirementBaselineId: baseline.id });
    expect(response.body.requirementDecisions).toHaveLength(2);
    expect(response.body.stackSelections).toEqual(expect.arrayContaining([expect.objectContaining({ stackKey: 'stack.typescript.nestjs', stackVersion: '10' })]));
  }, 180_000);
});
