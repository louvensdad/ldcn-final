import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/persistence/prisma.service';
import { MissionPersistenceService } from '../src/persistence/mission-persistence.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;
// Real DeepSeek calls cost real money and take real time (Customizer + up to 9 reviewers +
// Auto-Repair Loop + decisions) — opt-in only, never part of the default `npm run test:e2e`
// (same convention as deepseek-client.ts's own comment: "real calls stay out of the automated
// suite"). MISSÃO "Completar o fluxo de compra/personalização" Fase 23 explicitly asks for this
// real validation once — run with `LDCN_E2E_REAL_AI=1 DATABASE_URL=... npx jest --config
// jest.e2e.config.js marketplace-review-flow`.
const RUN_REAL_AI = process.env.LDCN_E2E_REAL_AI === '1';

/**
 * MISSÃO "Completar o fluxo de compra/personalização do Marketplace" — Fase 23 (E2E real): o
 * cenário exato do brief (clínica -> distribuidora de bebidas) rodado ponta a ponta contra HTTP
 * real, Postgres real e DeepSeek real. Nunca esconde uma falha real — se algum passo travar, o
 * teste falha em vez de tolerar silenciosamente (o objetivo desta missão é justamente eliminar
 * esse tipo de beco sem saída).
 */
(RUN_DB_TESTS && RUN_REAL_AI ? describe : describe.skip)('Marketplace review flow — clínica → distribuidora (e2e, real DeepSeek)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let referenceMissionId: string;
  let solutionId: string;
  let slug: string;
  let planId: string | undefined;
  let purchaseId: string | undefined;

  // NOTA DE AMBIENTE: instanciar @prisma/client (via PrismaService) carrega infra/.env inteiro
  // no processo (comportamento do runtime do Prisma, não algo que este código controla) — o que
  // inclui LDCN_API_KEY, ativando o ApiKeyGuard mesmo sem main.ts ter rodado. Isso é verdade para
  // TODOS os testes e2e deste projeto neste ambiente (confirmado: landing-page.e2e-spec.ts sofre
  // o mesmo 401 isoladamente), não algo introduzido por esta missão — daí o helper `api()` abaixo.
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
    if (purchaseId) {
      const purchase = await prisma.marketplacePurchase.findUnique({ where: { id: purchaseId } });
      if (purchase?.derivedProjectId) {
        await prisma.project.deleteMany({ where: { id: purchase.derivedProjectId } });
        await prisma.generationResult.deleteMany({ where: { missionId: purchase.derivedMissionId ?? undefined } });
        await prisma.generatorMissionState.deleteMany({ where: { missionId: purchase.derivedMissionId ?? undefined } });
      }
      await prisma.marketplacePurchase.deleteMany({ where: { id: purchaseId } });
    }
    if (planId) {
      const plan = await prisma.marketplaceCustomizationPlan.findUnique({ where: { id: planId } });
      if (plan) {
        await prisma.promptMasterDecision.deleteMany({ where: { missionId: plan.missionId } });
        await prisma.reviewFinding.deleteMany({ where: { missionId: plan.missionId } });
        await prisma.reviewerExecution.deleteMany({ where: { missionId: plan.missionId } });
        await prisma.requirement.deleteMany({ where: { missionId: plan.missionId } });
        await prisma.promptMasterVersion.deleteMany({ where: { missionId: plan.missionId } });
        await prisma.projectMission.deleteMany({ where: { missionId: plan.missionId } });
      }
      await prisma.marketplaceGenerationScope.deleteMany({ where: { customizationPlanId: planId } });
      await prisma.marketplacePricingQuote.deleteMany({ where: { customizationPlanId: planId } });
      await prisma.marketplaceCustomizationPlan.deleteMany({ where: { id: planId } });
    }
    if (solutionId) {
      await prisma.marketplaceSolutionVersion.deleteMany({ where: { solutionId } });
      await prisma.marketplaceSolution.deleteMany({ where: { id: solutionId } });
    }
    if (referenceMissionId) {
      await prisma.requirement.deleteMany({ where: { missionId: referenceMissionId } });
      await prisma.promptMasterVersion.deleteMany({ where: { missionId: referenceMissionId } });
      await prisma.generationResult.deleteMany({ where: { missionId: referenceMissionId } });
      await prisma.generatorMissionState.deleteMany({ where: { missionId: referenceMissionId } });
    }
    await app.close();
  });

  it('personalizar -> revisar -> resolver -> cotar -> comprar chega a zero blockers com IA real', async () => {
    // --- Seed: uma solução VERIFIED real de clínica (determinístico — mesmo padrão do teste
    // unitário; o que importa validar com IA real aqui é o fluxo de CUSTOMIZAÇÃO, não a autoria
    // conversacional da solução de referência). ---
    referenceMissionId = `e2e-ref-${randomUUID()}`;
    const session = await missionPersistence.hydrate(referenceMissionId);
    session.commands.generate({
      missionId: referenceMissionId,
      rawUserIdea: 'Sistema de gestão para clínica médica, com API backend e dashboard administrativo',
    });
    await missionPersistence.flush(referenceMissionId, session);

    const referencePromptMasterId = randomUUID();
    await prisma.promptMasterVersion.create({
      data: {
        id: referencePromptMasterId, missionId: referenceMissionId, version: 1,
        // MISSÃO "Targeted Generation": vision com as mesmas palavras-chave do rawUserIdea que
        // gerou o GenerationResult real da mission de referência acima — em produção o
        // PromptMaster e o rawUserIdea sempre vêm da mesma conversa (nunca divergem assim); um
        // texto de fixture divergente faria a topologia da mission derivada mudar só por causa do
        // teste, nunca por causa de uma mudança real do comprador.
        vision: 'Sistema de gestão para clínica médica, com API backend e dashboard administrativo', objective: 'Gerenciar pacientes, consultas e prontuários',
        targetAudience: 'Clínicas médicas de pequeno e médio porte', fullMarkdown: '# Sistema de Gestão para Clínica',
        hash: 'e2e', status: 'LOCKED', provider: 'deepseek', model: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, latencyMs: 0, lockedAt: new Date(),
      },
    });
    await prisma.requirement.createMany({
      data: [
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'features', content: 'Agendamento de consultas', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date() },
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'features', content: 'Cadastro de pacientes com prontuário eletrônico', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date() },
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'features', content: 'Recursos humanos e folha de pagamento da equipe médica', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date() },
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'outOfScope', content: 'Controle de estoque de produtos físicos', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'e2e', approvedBy: 'user', approvedAt: new Date() },
      ],
    });

    slug = `clinica-e2e-${randomUUID()}`;
    const createSolution = await api('post', '/marketplace/solutions')
      .send({ slug, name: 'Clínica Pro', description: 'Sistema completo de gestão para clínicas', publisherId: 'ldcn-core', category: 'templates' })
      .expect(201);
    solutionId = createSolution.body.id;

    const createVersion = await api('post', `/marketplace/solutions/${solutionId}/versions`)
      .send({ referenceMissionId, basePrice: 300000 })
      .expect(201);
    const versionId = createVersion.body.id;

    await api('post', `/marketplace/solutions/versions/${versionId}/verify`).expect(201);
    await api('post', `/marketplace/solutions/versions/${versionId}/publish`).expect(201);

    // --- Fase real da missão: o cenário exato do brief. ---
    const businessDescription =
      'Tenho uma distribuidora de bebidas. Não preciso de RH. Preciso controlar lotes, validade, vendedores externos e entregas.';

    const createPlan = await api('post', `/marketplace/solutions/${slug}/customization-plans`)
      .send({ rawBusinessDescription: businessDescription })
      .expect(201);
    planId = createPlan.body.id;
    // eslint-disable-next-line no-console
    console.log('[E2E] plano gerado:', JSON.stringify({
      businessContext: createPlan.body.businessContext, keep: createPlan.body.keep, remove: createPlan.body.remove,
      add: createPlan.body.add, needsClarification: createPlan.body.needsClarification, complexity: createPlan.body.complexity,
    }, null, 2));

    expect(createPlan.body.needsClarification).toBe(false); // descrição real e específica o suficiente

    let planState = createPlan.body;
    let approveRes = await api('post', `/marketplace/customization-plans/${planId}/approve`).send({});
    // eslint-disable-next-line no-console
    console.log('[E2E] approve #1 status HTTP:', approveRes.status, 'plan.status:', approveRes.body.status, 'review:', approveRes.body.review?.status);

    // --- Fase 6/8/17: a IA resolve o que dá sozinha; o que sobrar, resolvemos aqui como o
    // comprador faria — escolhendo a primeira recomendação real do reviewer (nunca inventando
    // texto). Loop limitado (mesmo teto do servidor: MAX_REVIEW_ATTEMPTS). ---
    for (let attempt = 0; attempt < 5 && approveRes.body.status !== 'APPROVED'; attempt++) {
      expect(approveRes.status).toBe(201); // nunca um erro técnico cru — sempre 2xx com o estado real
      planState = approveRes.body;
      const openDecisions = (planState.review?.findings ?? []).filter(
        (f: { status: string; decisionOutcome: string }) => f.status === 'OPEN' && (f.decisionOutcome === 'USER_DECISION_REQUIRED' || f.decisionOutcome === 'BLOCKED')
      );
      // eslint-disable-next-line no-console
      console.log(`[E2E] tentativa ${attempt}: review.status=${planState.review?.status}, decisões abertas=${openDecisions.length}`);
      if (openDecisions.length === 0) break;

      for (const finding of openDecisions) {
        const chosenOption: string = finding.recommendedResolutions[0] ?? 'Aplicar a solução mais segura disponível';
        // eslint-disable-next-line no-console
        console.log(`[E2E] decidindo achado ${finding.code} (${finding.reviewerKey}): "${chosenOption}"`);
        const decideRes = await api('post', `/marketplace/customization-plans/${planId}/findings/${finding.id}/decide`)
          .send({ chosenOption });
        expect(decideRes.status).toBe(201);
      }

      approveRes = await api('post', `/marketplace/customization-plans/${planId}/approve`).send({});
    }

    planState = approveRes.body;
    // eslint-disable-next-line no-console
    console.log('[E2E] estado final do plano:', planState.status, 'gate:', JSON.stringify(planState.review?.gate));

    expect(planState.status).toBe('APPROVED'); // zero blockers restantes — nunca chega a quote/purchase com blocker

    // --- Cotação + compra reais. ---
    const quoteRes = await api('post', `/marketplace/customization-plans/${planId}/quote`).send({}).expect(201);
    const purchaseRes = await api('post', `/marketplace/customization-plans/${planId}/purchase`)
      .send({ pricingQuoteId: quoteRes.body.id })
      .expect(201);
    purchaseId = purchaseRes.body.id;

    expect(purchaseRes.body.derivedProjectId).toBeTruthy();
    expect(purchaseRes.body.generation.status).toBe('SUCCEEDED');

    // --- MISSÃO "Targeted Generation": prova real que a geração calculou impacto de verdade e
    // reaproveitou (ou justificadamente não reaproveitou) as decisões da solução de referência —
    // nunca "gerou tudo de novo" sem checar, nunca um número fabricado só para a UI. ---
    const generation = purchaseRes.body.generation;
    // eslint-disable-next-line no-console
    console.log('[E2E] Targeted Generation:', JSON.stringify(generation));
    expect(['TARGETED', 'FULL']).toContain(generation.generationMode);
    expect(generation.totalRequirements).toBeGreaterThan(0);
    expect(generation.impactScore).toBeGreaterThanOrEqual(0);
    expect(generation.impactScore).toBeLessThanOrEqual(1);

    const scope = await prisma.marketplaceGenerationScope.findUnique({ where: { customizationPlanId: planId } });
    expect(scope).toBeTruthy();
    expect(scope!.completedAt).toBeTruthy(); // o outcome real (actualReuse/escalations) foi registrado, nunca deixado em branco
    // eslint-disable-next-line no-console
    console.log('[E2E] GenerationScope real:', JSON.stringify({
      changeClasses: scope!.changeClassesJson, generationMode: scope!.generationMode,
      actualReuse: scope!.actualReuseJson, escalations: scope!.escalationsJson,
      reusedRequirements: scope!.reusedRequirements, totalRequirements: scope!.totalRequirements,
    }));

    if (generation.generationMode === 'TARGETED') {
      // Reaproveitamento real, verificável no próprio GenerationResult persistido — nunca só um rótulo.
      const referenceResult = await prisma.generationResult.findUnique({ where: { missionId: referenceMissionId } });
      const derivedResult = await prisma.generationResult.findUnique({ where: { missionId: planState.missionId } });
      const actualReuse = scope!.actualReuseJson as { reuseStackSelection: boolean; reuseArchitecture: boolean; reuseTeam: boolean };
      if (actualReuse.reuseStackSelection) {
        const referenceStacks = (referenceResult?.resultJson as { approvedSolution: { selectedStacks: { stackKey: string }[] } }).approvedSolution.selectedStacks.map((s) => s.stackKey).sort();
        const derivedStacks = (derivedResult?.resultJson as { approvedSolution: { selectedStacks: { stackKey: string }[] } }).approvedSolution.selectedStacks.map((s) => s.stackKey).sort();
        expect(derivedStacks).toEqual(referenceStacks);
      }
    }

    const project = await prisma.project.findUnique({ where: { id: purchaseRes.body.derivedProjectId } });
    expect(project?.sourceSolutionId).toBe(solutionId);
    expect(project?.purchaseId).toBe(purchaseId);

    // --- Provenance: original nunca alterado. ---
    const originalRequirements = await prisma.requirement.findMany({ where: { missionId: referenceMissionId } });
    expect(originalRequirements.every((r) => r.status === 'CONFIRMED')).toBe(true);
    const originalSolution = await prisma.marketplaceSolution.findUnique({ where: { id: solutionId } });
    expect(originalSolution?.status).toBe('VERIFIED');

    // eslint-disable-next-line no-console
    console.log('[E2E] SUCESSO — purchase:', purchaseId, 'derivedProjectId:', purchaseRes.body.derivedProjectId);
  }, 1_800_000);
});
