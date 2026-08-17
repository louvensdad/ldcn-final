import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';
import { RequirementBaselineService } from '../src/requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../src/requirements/scope-coverage.service';

const RUN = !!(process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL) && !!process.env.DEEPSEEK_API_KEY && process.env.LDCN_E2E_REAL_AI === '1';

(RUN ? describe : describe.skip)('CORE-013 real provider architecture council (optional e2e)', () => {
  let app: INestApplication, prisma: PrismaService, baselines: RequirementBaselineService, scope: ScopeCoverageService;
  const missionId = `e2e-core013-real-${randomUUID()}`;
  beforeAll(async () => { const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); await app.init(); prisma = app.get(PrismaService); baselines = app.get(RequirementBaselineService); scope = app.get(ScopeCoverageService); });
  afterAll(async () => {
    await prisma.architectureReviewFinding.deleteMany({ where: { missionId } }); await prisma.architectureReviewerExecution.deleteMany({ where: { missionId } }); await prisma.architectureReview.deleteMany({ where: { missionId } }); const compositions = await prisma.architectureComposition.findMany({ where: { missionId }, select: { id: true } }); await prisma.architectureArbitration.deleteMany({ where: { architectureCompositionId: { in: compositions.map(x => x.id) } } }); await prisma.architectureComposition.deleteMany({ where: { missionId } }); await prisma.approvedSolution.deleteMany({ where: { missionId } }); await prisma.scopeCoverageDecision.deleteMany({ where: { missionId } }); await prisma.requirementBaseline.deleteMany({ where: { missionId } }); await prisma.llmInvocationRecord.deleteMany({ where: { missionId } }); await prisma.promptSnapshot.deleteMany({ where: { missionId } }); await prisma.agentExecution.deleteMany({ where: { missionId } }); await prisma.eventLog.deleteMany({ where: { missionId } }); await prisma.requirement.deleteMany({ where: { missionId } }); await app.close();
  });
  it('executes proposal and both council reviewers through the production endpoints/provider', async () => {
    await prisma.requirement.createMany({ data: [{ id: randomUUID(), missionId, section: 'features', content: 'API para cadastrar e consultar clientes', origin: 'USER', status: 'CONFIRMED', createdBy: 'user', requirementKey: 'REQ-001', category: 'FUNCTIONAL', source: 'USER_EXPLICIT' }] });
    const baseline = await baselines.createBaseline(missionId); const ref = baseline.requirementRefs[0]; await scope.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: 'IN_SCOPE', decisionSource: 'USER' }); await baselines.finalizeBaseline(missionId, baseline.id); await scope.finalizeCoverage(missionId, baseline.id);
    const solution = await request(app.getHttpServer()).post(`/missions/${missionId}/solution-planning/start`).set('x-api-key', process.env.LDCN_API_KEY ?? '').send({ requirementBaselineId: baseline.id }).expect(201);
    const architecture = await request(app.getHttpServer()).post(`/missions/${missionId}/architecture/start`).set('x-api-key', process.env.LDCN_API_KEY ?? '').send({ approvedSolutionId: solution.body.id });
    if (architecture.status !== 201) throw new Error(`REAL_ARCHITECTURE_HTTP_${architecture.status}:${JSON.stringify(architecture.body)}`);
    expect(architecture.body).toMatchObject({ missionId, approvedSolutionId: solution.body.id, status: 'APPROVED' }); expect(architecture.body.requirementMappings).toHaveLength(1); expect(await prisma.architectureReviewerExecution.count({ where: { missionId } })).toBe(2);
  }, 300_000);
});
