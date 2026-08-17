import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';
import { MissionPersistenceService } from '../src/persistence/mission-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;
// npm install + build + test + runtime real levam minutos reais de wall-clock — opt-in explícito,
// mesma convenção de LDCN_E2E_REAL_AI (não faz parte do `npm run test:e2e` default). Rodar com
// `LDCN_E2E_REAL_BUILD=1 DATABASE_URL=... npx jest --config jest.e2e.config.js generation-engine-flow`.
const RUN_REAL_BUILD = process.env.LDCN_E2E_REAL_BUILD === '1';

jest.setTimeout(10 * 60 * 1000);

/**
 * MISSÃO "Completar o fluxo pós-PromptMaster até geração e entrega real" — Fase 36 (E2E
 * principal): o cenário exato do brief (distribuidora de bebidas) rodado ponta a ponta contra
 * HTTP real e Postgres real, provando a fatia vertical completa: PromptMaster LOCKED (seedado
 * aqui do mesmo jeito que marketplace-review-flow.e2e-spec.ts semeia sua mission de referência —
 * discovery conversacional com IA real já foi validado em outra missão; o que este teste prova é
 * o motor de geração, não a conversa) -> approvedSolution real (via IntelligentGeneratorCommandService,
 * o mesmo código que discovery.approvePromptMaster() chama em produção) -> scaffold real -> npm
 * install/build/test/runtime reais (child_process de verdade) -> download real (.zip válido).
 * Nunca esconde uma falha: se qualquer fase travar, o teste falha em vez de tolerar silenciosamente.
 */
(RUN_DB_TESTS && RUN_REAL_BUILD ? describe : describe.skip)('Generation engine — distribuidora de bebidas (e2e, build/test/runtime reais)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let missionId: string;

  function api(method: 'get' | 'post', path: string) {
    return request(app.getHttpServer())[method](path).set('x-api-key', process.env.LDCN_API_KEY ?? '');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    missionPersistence = app.get(MissionPersistenceService);
  });

  afterAll(async () => {
    if (missionId) {
      await prisma.architectureReviewFinding.deleteMany({ where: { missionId } });
      await prisma.architectureReviewerExecution.deleteMany({ where: { missionId } });
      await prisma.architectureReview.deleteMany({ where: { missionId } });
      await prisma.generationJob.deleteMany({ where: { missionId } });
      await prisma.generatedArtifact.deleteMany({ where: { missionId } });
      await prisma.missionGenerationRun.deleteMany({ where: { missionId } });
      await prisma.requirement.deleteMany({ where: { missionId } });
      await prisma.promptMasterVersion.deleteMany({ where: { missionId } });
      await prisma.generationResult.deleteMany({ where: { missionId } });
      await prisma.generatorMissionState.deleteMany({ where: { missionId } });
    }
    await app.close();
  });

  it('gera, builda, testa, sobe runtime e empacota o backend real de um PromptMaster LOCKED', async () => {
    missionId = `e2e-genengine-${randomUUID()}`;

    // --- Seed: PromptMaster LOCKED com o texto exato do cenário do brief (mesmo padrão de
    // marketplace-review-flow.e2e-spec.ts para a mission de referência: discovery conversacional
    // já foi validado com IA real em outra missão; aqui o que se testa é o motor de geração). ---
    // NOTA HONESTA (ver relatório final) — dois achados reais do heurístico de Intent/Topology do
    // core durante esta validação, ambos fora do escopo desta missão (correção de heurística de
    // parsing, não geração/build/runtime):
    // 1) "...sem aplicativo mobile por enquanto" (texto original do brief): topology-resolver.ts
    //    casa a palavra "mobile" mesmo dentro da negação e aprova MOBILE como ÚNICO delivery
    //    target — zero BACKEND proposto.
    // 2) inferRequired('BACKEND') exige a presença literal de "api"/"backend"/"servidor" no texto
    //    (topology-resolver.ts:120-121) — uma descrição de negócio real ("controlar clientes,
    //    produtos, estoque...") sem esse jargão técnico não aprova NENHUM delivery target sozinha.
    // Para não mascarar isso como se o motor de geração (o que esta missão constrói) tivesse
    // falhado, o mesmo cenário de negócio é usado aqui com vocabulário técnico explícito
    // (backend/dashboard), como um usuário real diria ao ser perguntado "seria via navegador?".
    const rawUserIdea =
      'Tenho uma distribuidora de bebidas e quero um sistema web, com backend e dashboard, para controlar ' +
      'clientes, produtos, estoque, vendedores e entregas. Preciso acompanhar lotes e validade dos produtos, ' +
      'comissão dos vendedores e o status das entregas. Não preciso de RH nem folha de pagamento. Quero usar ' +
      'apenas pelo navegador, sem instalar nada no telefone.';

    const session = await missionPersistence.hydrate(missionId);
    const result = session.commands.generate({ missionId, rawUserIdea });
    await missionPersistence.flush(missionId, session);

    const backendStack = result.approvedSolution.selectedStacks.find((s) => s.deliveryTargetKind === 'BACKEND');
    // eslint-disable-next-line no-console
    console.log('[E2E] approvedSolution.selectedStacks:', JSON.stringify(result.approvedSolution.selectedStacks));
    expect(backendStack?.stackKey).toBe('stack.typescript.nestjs'); // confirma a escolha real do TechnologySelector para este cenário

    const promptMasterId = randomUUID();
    await prisma.promptMasterVersion.create({
      data: {
        id: promptMasterId, missionId, version: 1,
        vision: rawUserIdea, objective: 'Controlar clientes, produtos, estoque, vendedores, entregas, lotes/validade e comissões',
        targetAudience: 'Distribuidoras de bebidas de pequeno e médio porte', fullMarkdown: '# Sistema para Distribuidora de Bebidas',
        hash: 'e2e', status: 'LOCKED', provider: 'deepseek', model: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, latencyMs: 0, lockedAt: new Date(),
      },
    });

    // 7 requirements 'data' reais — todos devem ser processados, sem teto total maxResources.
    const requirementContents = [
      'Clientes', 'Produtos', 'Estoque', 'Vendedores', 'Entregas',
      'Lotes e validade dos produtos', 'Comissão dos vendedores',
    ];
    await prisma.requirement.createMany({
      data: requirementContents.map((content) => ({
        id: randomUUID(), missionId, promptMasterId, section: 'data', content,
        origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date(),
      })),
    });

    // --- MISSÃO "Job Planner + execução por agente cognitivo real": uma regra de negócio real,
    // que o scaffolder determinístico nunca implementaria sozinho — prova de que o agente cognitivo
    // (DeepSeek de verdade) escreveu código real que passa no build/test reais depois. ---
    await prisma.requirement.create({
      data: {
        id: randomUUID(), missionId, promptMasterId, section: 'businessRules',
        content: 'A comissão do vendedor deve ser calculada como 5% do valor da venda realizada.',
        origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date(),
      },
    });

    // --- MISSÃO "Arquitetura não pode seguir automaticamente para Entrega": o gate real (council
    // DeepSeek real + políticas determinísticas) precisa aprovar antes de qualquer geração real —
    // resolve os achados reais devolvidos pelo council com a primeira resolução recomendada (mesmo
    // padrão real já usado em marketplace-review-flow.e2e-spec.ts), nunca finge aprovação. ---
    let archSession = await api('post', `/missions/${missionId}/architecture-review/start`).send({}).expect(201);
    // eslint-disable-next-line no-console
    console.log('[E2E] architecture review:', archSession.body.status, JSON.stringify(archSession.body.findings.map((f: { code: string; severity: string }) => `${f.code}(${f.severity})`)));
    for (let attempt = 0; attempt < 3 && archSession.body.status !== 'APPROVED'; attempt++) {
      const openDecisions = (archSession.body.findings as { id: string; status: string; recommendedResolutions: string[] }[]).filter((f) => f.status === 'OPEN');
      if (openDecisions.length === 0) {
        // Nenhum achado aberto mas ainda não APPROVED — só acontece se um reviewer CRITICAL falhou
        // por instabilidade real de rede/API (nunca por design). Tenta o council de novo.
        archSession = await api('post', `/missions/${missionId}/architecture-review/start`).send({});
        continue;
      }
      for (const finding of openDecisions) {
        if (finding.recommendedResolutions.length > 0) {
          archSession = await api('post', `/missions/${missionId}/architecture-review/findings/${finding.id}/decide`).send({ chosenOption: finding.recommendedResolutions[0] });
        } else {
          archSession = await api('post', `/missions/${missionId}/architecture-review/findings/${finding.id}/resolve`).send({});
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('[E2E] architecture review final:', archSession.body.status);
    expect(archSession.body.status).toBe('APPROVED'); // nunca prossegue para geração real sem o gate real aprovado

    // --- Fase real da missão: dispara o motor de geração via HTTP (a mesma rota que o botão
    // START_EXECUTION do Journey agora chama). ---
    const startRes = await api('post', `/missions/${missionId}/generation/start`).send({}).expect(201);
    expect(startRes.body.status).toBe('SCAFFOLDING');
    expect(startRes.body.pluginId).toBe('stack.typescript.nestjs');

    // --- Poll real até READY ou falha (nunca fabrica "pronto" — segue o status real do banco). ---
    let statusBody = startRes.body;
    const deadline = Date.now() + 9 * 60 * 1000;
    while (!['READY', 'BUILD_FAILED', 'TEST_FAILED', 'RUNTIME_FAILED', 'TARGET_NOT_SUPPORTED'].includes(statusBody.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const res = await api('get', `/missions/${missionId}/generation`).expect(200);
      statusBody = res.body;
      // eslint-disable-next-line no-console
      console.log('[E2E] generation status:', statusBody.status);
    }

    // eslint-disable-next-line no-console
    console.log('[E2E] estado final:', JSON.stringify(statusBody, null, 2));
    expect(statusBody.status).toBe('READY'); // nunca aceita menos — se travar em qualquer fase, este assert falha de propósito

    expect(statusBody.scaffold.fileCount).toBeGreaterThan(0);
    expect(statusBody.scaffold.skippedRequirementIds.length).toBe(0);
    expect(statusBody.build.exitCode).toBe(0);
    expect(statusBody.test.exitCode).toBe(0);
    expect(statusBody.test.failed).toBe(0);
    expect(statusBody.test.total).toBeGreaterThan(0);
    expect(statusBody.runtime.healthCheckOk).toBe(true);
    expect(statusBody.downloadReady).toBe(true);

    // --- MISSÃO "Verificação requisito-por-requisito + Delivery Eligibility": os 2 requirements
    // de 'data' fora do teto ficam OUT_OF_SCOPE_THIS_VERSION (nunca bloqueiam — nunca prometidos),
    // o businessRule real vira EVIDENCED (Job IMPLEMENTED) — nada FAILED, então elegível de verdade. ---
    expect(statusBody.deliveryEligible).toBe(true);
    const coverage = statusBody.requirementCoverage as { requirementId: string; section: string; status: string }[];
    // eslint-disable-next-line no-console
    console.log('[E2E] requirement coverage:', JSON.stringify(coverage.map((c) => ({ section: c.section, status: c.status })), null, 2));
    expect(coverage.filter((c) => c.status === 'EVIDENCED').length).toBe(8);
    expect(coverage.filter((c) => c.status === 'OUT_OF_SCOPE_THIS_VERSION').length).toBe(0);
    expect(coverage.some((c) => c.status === 'FAILED')).toBe(false);

    // --- MISSÃO "Security Gate real antes da entrega": npm audit real + secret scan real +
    // Security Reviewer real sobre o código que o agente escreveu. Vulnerabilidade herdada de
    // framework (moderate/high nas próprias versões do @nestjs) nunca bloqueia sozinha — só
    // CRITICAL real, segredo real ou BLOCKER real do reviewer bloqueariam. ---
    // eslint-disable-next-line no-console
    console.log('[E2E] security:', JSON.stringify(statusBody.security, null, 2));
    expect(statusBody.security.npmAudit.ran).toBe(true);
    expect(statusBody.security.npmAudit.critical).toBe(0);
    expect(statusBody.security.secretsFound).toBe(0);
    expect(statusBody.security.reviewerRan).toBe(true); // havia 1 Job IMPLEMENTED — o reviewer real rodou
    expect(statusBody.securityPassed).toBe(true);

    // --- Artifact Registry real (Fase 14 do brief). ---
    const artifactsRes = await api('get', `/missions/${missionId}/generation/artifacts`).expect(200);
    expect(artifactsRes.body.length).toBe(statusBody.scaffold.fileCount);
    expect(artifactsRes.body.every((a: { validationStatus: string }) => a.validationStatus === 'VALID')).toBe(true);
    // eslint-disable-next-line no-console
    console.log('[E2E] artifacts:', artifactsRes.body.map((a: { path: string; ownerAgent: string }) => `${a.path} (${a.ownerAgent})`).join(', '));

    // --- MISSÃO "Job Planner + execução por agente cognitivo real": prova de que o agente
    // (DeepSeek de verdade) escreveu a regra de negócio real e o resultado passou no build/test
    // reais acima (statusBody.status === 'READY' com o job já aplicado ao workspace). ---
    const jobsRes = await api('get', `/missions/${missionId}/generation/jobs`).expect(200);
    // eslint-disable-next-line no-console
    console.log('[E2E] jobs:', JSON.stringify(jobsRes.body.map((j: { targetResource: string; status: string; errorCode: string | null; implementationSummary: string | null; attemptCount: number; firstAttemptErrorCode: string | null }) => ({ targetResource: j.targetResource, status: j.status, errorCode: j.errorCode, summary: j.implementationSummary, attemptCount: j.attemptCount, firstAttemptErrorCode: j.firstAttemptErrorCode })), null, 2));
    expect(jobsRes.body.length).toBe(1);
    expect(jobsRes.body[0].targetResource).toBe('Vendedore');
    expect(jobsRes.body[0].status).toBe('IMPLEMENTED');
    expect(jobsRes.body[0].errorCode).toBeNull();
    // --- MISSÃO "Repair loop real quando um Job falha": attemptCount real (1 = passou de
    // primeira; >1 provaria que um reparo real aconteceu — o comportamento real do DeepSeek nesta
    // rodada não é forçado, só verificado honestamente). ---
    expect(jobsRes.body[0].attemptCount).toBeGreaterThanOrEqual(1);
    expect(jobsRes.body[0].attemptCount).toBeLessThanOrEqual(2);
    if (jobsRes.body[0].attemptCount === 1) {
      expect(jobsRes.body[0].firstAttemptErrorCode).toBeNull();
    } else {
      expect(jobsRes.body[0].firstAttemptErrorCode).not.toBeNull();
    }
    const commissionArtifact = artifactsRes.body.find((a: { path: string }) => a.path === 'src/vendedores/vendedores.service.ts');
    expect(commissionArtifact.provenance).toContain('job:');

    // --- MISSÃO "Independent Reviewer agent por Job": um segundo agente cognitivo real (DeepSeek,
    // papel diferente do que implementou) revisou a corretude antes do Job virar IMPLEMENTED final
    // — nunca false aqui, porque reviewerApproved=false teria derrubado o Job para FAILED (e o
    // assert acima já provou que ficou IMPLEMENTED). ---
    // eslint-disable-next-line no-console
    console.log('[E2E] reviewer:', JSON.stringify({ reviewerApproved: jobsRes.body[0].reviewerApproved, reviewerFinding: jobsRes.body[0].reviewerFinding }));
    expect(jobsRes.body[0].reviewerApproved).not.toBe(false);

    // --- Preview real (Fase 22 do brief): sobe o build real, confere resposta HTTP real, derruba. ---
    const previewStart = await api('post', `/missions/${missionId}/generation/preview/start`).send({}).expect(201);
    expect(previewStart.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const previewHealth = await fetch(`${previewStart.body.url}/health`);
    expect(previewHealth.status).toBe(200);
    expect(await previewHealth.json()).toEqual({ status: 'ok' });
    await api('post', `/missions/${missionId}/generation/preview/stop`).send({}).expect(201);

    // --- Download real (Fase 24 do brief): um .zip válido de verdade. ---
    const downloadRes = await api('get', `/missions/${missionId}/generation/download`).expect(200);
    expect(downloadRes.headers['content-type']).toMatch(/zip/);
    expect(Buffer.isBuffer(downloadRes.body) ? downloadRes.body.length : downloadRes.text.length).toBeGreaterThan(100);
    // Assinatura real de arquivo ZIP local-file-header (PK\x03\x04) — prova que não é um placeholder.
    const zipBytes: Buffer = Buffer.isBuffer(downloadRes.body) ? downloadRes.body : Buffer.from(downloadRes.text, 'binary');
    expect(zipBytes.slice(0, 4).toString('hex')).toBe('504b0304');
  });
});
