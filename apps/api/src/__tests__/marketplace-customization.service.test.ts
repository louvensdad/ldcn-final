import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { OperationPersistenceService } from '../operations/operation-persistence.service';
import { EventBusService } from '../events/event-bus.service';
import { GeneratorService } from '../generator/generator.service';
import { ReviewFindingService } from '../review/review-finding.service';
import { ReviewCouncilService } from '../review/review-council.service';
import { PromptMasterDecisionPolicy } from '../review/decision-policy.service';
import { PromptMasterEditingService } from '../review/prompt-master-editing.service';
import { MarketplaceSolutionService } from '../marketplace/marketplace-solution.service';
import { MarketplaceCustomizationService } from '../marketplace/marketplace-customization.service';
import { MarketplaceReviewService } from '../marketplace/marketplace-review.service';
import { MarketplaceSolutionRevalidationService } from '../marketplace/marketplace-solution-revalidation.service';
import { MarketplaceGenerationScopeService } from '../marketplace/marketplace-generation-scope.service';
import { MarketplaceBillingService } from '../marketplace/marketplace-billing.service';
import { MarketplacePurchaseService } from '../marketplace/marketplace-purchase.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'deepseek-chat', promptTokens: 100, completionTokens: 50 };
}
const NO_FINDINGS = turn({ findings: [] });

class QueuedFakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  defaultResult: LlmCompletionResult | null = NO_FINDINGS;
  private queue: (LlmCompletionResult | 'FAIL')[] = [];
  push(...items: (LlmCompletionResult | 'FAIL')[]) { this.queue.push(...items); }
  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queue.shift();
    if (!next) { if (this.defaultResult) return this.defaultResult; throw new Error('no more queued responses'); }
    if (next === 'FAIL') throw new Error('simulated LLM failure');
    return next;
  }
}

(RUN_DB_TESTS ? describe : describe.skip)('MarketplaceCustomizationService + Billing + Purchase (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let fakeLlm: QueuedFakeLlmClient;
  let solutions: MarketplaceSolutionService;
  let customization: MarketplaceCustomizationService;
  let review: MarketplaceReviewService;
  let billing: MarketplaceBillingService;
  let purchases: MarketplacePurchaseService;

  const RICH_ERP_IDEA = 'Quero um sistema ERP com API backend e dashboard administrativo para gerenciar clientes, produtos e estoque de uma distribuidora';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
  });

  beforeEach(() => {
    fakeLlm = new QueuedFakeLlmClient();
    const reviewFindings = new ReviewFindingService(prisma);
    const ledger = new LlmInvocationLedgerService(prisma);
    const reviewCouncil = new ReviewCouncilService(prisma, reviewFindings, fakeLlm, ledger);
    const decisionPolicy = new PromptMasterDecisionPolicy();
    const editing = new PromptMasterEditingService(prisma, reviewFindings, reviewCouncil, decisionPolicy, fakeLlm, ledger);
    const generator = new GeneratorService(missionPersistence, new OperationPersistenceService(prisma), new EventBusService());
    solutions = new MarketplaceSolutionService(prisma, missionPersistence, reviewFindings);
    review = new MarketplaceReviewService(prisma, reviewFindings, reviewCouncil, decisionPolicy, editing);
    const revalidation = new MarketplaceSolutionRevalidationService(prisma);
    const generationScope = new MarketplaceGenerationScopeService(prisma);
    customization = new MarketplaceCustomizationService(prisma, solutions, reviewCouncil, editing, review, revalidation, generationScope, generator, fakeLlm, ledger);
    billing = new MarketplaceBillingService(prisma);
    purchases = new MarketplacePurchaseService(prisma, customization, generationScope);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string) {
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.promptMasterDecision.deleteMany({ where: { missionId } });
    await prisma.reviewFinding.deleteMany({ where: { missionId } });
    await prisma.reviewerExecution.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.promptMasterVersion.deleteMany({ where: { missionId } });
    await prisma.projectMission.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  async function cleanupSolution(solutionId: string) {
    await prisma.marketplaceGenerationScope.deleteMany({ where: { solutionId } });
    await prisma.marketplacePurchase.deleteMany({ where: { solutionId } });
    await prisma.marketplacePricingQuote.deleteMany({ where: { solutionId } });
    await prisma.marketplaceCustomizationPlan.deleteMany({ where: { solutionId } });
    await prisma.marketplaceSolutionVersion.deleteMany({ where: { solutionId } });
    await prisma.marketplaceSolution.deleteMany({ where: { id: solutionId } });
  }

  async function seedVerifiedSolution(): Promise<{ solutionId: string; slug: string; referenceMissionId: string }> {
    const referenceMissionId = `ref-${randomUUID()}`;
    const session = await missionPersistence.hydrate(referenceMissionId);
    session.commands.generate({ missionId: referenceMissionId, rawUserIdea: RICH_ERP_IDEA });
    await missionPersistence.flush(referenceMissionId, session);

    const referencePromptMasterId = randomUUID();
    await prisma.promptMasterVersion.create({
      data: {
        id: referencePromptMasterId, missionId: referenceMissionId, version: 1,
        // MISSÃO "Targeted Generation": vision igual ao RICH_ERP_IDEA (mesmas palavras-chave que
        // dirigiram o Generator.generate() real da missão de referência acima) — senão uma compra
        // "como está" (enrichedIdea = vision+objective+features) produziria uma topologia/stack
        // DIFERENTE da referência só por causa de um texto de fixture divergente, nunca por causa
        // de uma mudança real do comprador. Em produção o PromptMaster e o rawUserIdea que gerou a
        // arquitetura de referência sempre vêm da mesma conversa — nunca divergem assim.
        vision: RICH_ERP_IDEA, objective: 'Gerenciar clientes, produtos e estoque',
        targetAudience: 'Distribuidoras', fullMarkdown: '# ERP Enterprise', hash: 'x', status: 'LOCKED',
        provider: 'deepseek', model: 'deepseek-chat', promptTokens: 0, completionTokens: 0, latencyMs: 0, lockedAt: new Date(),
      },
    });
    await prisma.requirement.createMany({
      data: [
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'features', content: 'Cadastro de clientes', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', approvedBy: 'user', approvedAt: new Date() },
        { id: randomUUID(), missionId: referenceMissionId, promptMasterId: referencePromptMasterId, section: 'features', content: 'Recursos humanos e folha de pagamento', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', approvedBy: 'user', approvedAt: new Date() },
      ],
    });

    const slug = `erp-test-${randomUUID()}`;
    const solution = await solutions.createSolution({ slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates' });
    const version = await solutions.createVersionFromMission(solution.id, { referenceMissionId, basePrice: 250000 });
    await solutions.runVerificationGate(version.id);
    await solutions.publishVersion(version.id);
    return { solutionId: solution.id, slug, referenceMissionId };
  }

  it('createCustomizationPlan(asIs=true): clones every confirmed requirement, never calls the Customizer AI, PATCH/LOW by default', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, asIs: true });
      expect(plan.keep).toContain('Cadastro de clientes');
      expect(plan.remove).toHaveLength(0);
      expect(plan.complexity).toBe('LOW');
      expect(plan.architectureImpact).toBe('PATCH');
      expect(fakeLlm.calls).toHaveLength(0); // "comprar como está" nunca chama IA de personalização

      const clonedRequirements = await prisma.requirement.findMany({ where: { missionId: plan.missionId } });
      expect(clonedRequirements.every((r) => r.sourceSolutionId === solutionId)).toBe(true);
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('createCustomizationPlan: a real business description drives a real classified plan — RH removed, architectural change never silently applied', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas, não precisa de RH.',
          keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [],
          add: [
            { section: 'features', content: 'Controle de lote e validade no estoque', type: 'MODULE' },
            { section: 'features', content: 'Reescrever tudo em Python e Flutter', type: 'ARCHITECTURAL' },
          ],
          missingInformation: [], assumptions: [], confidence: 0.85,
        })
      );

      plan = await customization.createCustomizationPlan({
        solutionSlug: slug,
        rawBusinessDescription: 'Tenho uma distribuidora de bebidas, não preciso de RH, preciso de controle de lote e validade.',
      });

      expect(plan.remove.map((r) => r.targetContent)).toContain('Recursos humanos e folha de pagamento');
      expect(plan.add.map((a) => a.content)).toContain('Controle de lote e validade no estoque');
      // Mudança arquitetural NUNCA aplicada em silêncio — fica fora de add/modify/remove.
      expect(plan.add.map((a) => a.content)).not.toContain('Reescrever tudo em Python e Flutter');
      expect(plan.architecturalChangesDetected).toContain('Reescrever tudo em Python e Flutter');
      expect(plan.architectureImpact).toBe('NEW_ARCHITECTURE_REQUIRED');
      expect(plan.requiresUserDecision).toBe(true);
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Fase 20: a transient Customizer AI failure self-heals via automatic retry — never surfaces as MARKETPLACE_CUSTOMIZER_AI_UNAVAILABLE on the first hiccup', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        'FAIL', // attempt 1 — falha transitória de rede
        turn({
          businessContext: 'Distribuidora de bebidas.', keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [], add: [], missingInformation: [], assumptions: [], confidence: 0.85,
        }) // attempt 2 — self-heals
      );

      plan = await customization.createCustomizationPlan({ solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas, sem RH.' });
      expect(plan.remove.map((r) => r.targetContent)).toContain('Recursos humanos e folha de pagamento');
      expect(fakeLlm.calls).toHaveLength(2); // 1 falha + 1 retry — nunca mais que o teto
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('approvePlan: applies remove/add for real, runs the real Review Council, locks the derived PromptMaster — never touches the original', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas.',
          keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [], add: [], missingInformation: [], assumptions: [], confidence: 0.85,
        })
      );
      plan = await customization.createCustomizationPlan({
        solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas, sem RH.',
      });

      // Review Council real roda dentro de approvePlan — precisa de respostas para os 4 core reviewers.
      fakeLlm.push(NO_FINDINGS, NO_FINDINGS, NO_FINDINGS, NO_FINDINGS);
      const approved = await customization.approvePlan(plan.id);
      expect(approved.status).toBe('APPROVED');

      const rhRequirement = await prisma.requirement.findFirst({ where: { missionId: plan.missionId, content: 'Recursos humanos e folha de pagamento' } });
      expect(rhRequirement?.status).toBe('REJECTED');

      const derivedPromptMaster = await prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId } });
      expect(derivedPromptMaster?.status).toBe('LOCKED');
      expect(derivedPromptMaster?.sourceSolutionId).toBe(solutionId);

      // O PromptMaster de referência da solução original nunca foi tocado (seção 22).
      const originalRh = await prisma.requirement.findFirst({ where: { missionId: referenceMissionId, content: 'Recursos humanos e folha de pagamento' } });
      expect(originalRh?.status).toBe('CONFIRMED');
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Billing: quoteForPlan is fully deterministic — never calls the LLM, complexity drives the price', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, asIs: true });
      // Fase 17/22: cotação exige plano APPROVED — o Review Council roda dentro de approvePlan (4
      // core reviewers respondem via defaultResult NO_FINDINGS).
      await customization.approvePlan(plan.id);
      const callsBefore = fakeLlm.calls.length;
      const quote = await billing.quoteForPlan(plan.id);

      expect(fakeLlm.calls.length).toBe(callsBefore); // billing nunca chama IA
      expect(quote.basePrice).toBe(250000);
      expect(quote.customizationPrice).toBe(0); // LOW complexity -> 0% de acréscimo
      expect(quote.total).toBe(250000);
      expect(new Date(quote.validUntil).getTime()).toBeGreaterThan(Date.now());
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Purchase: creates a real Project + Purchase, triggers real generation, never allows an expired quote', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, asIs: true });
      // "Recursos humanos e folha de pagamento" (mantido, pois asIs=true) aciona o sinal de
      // roteamento do Security reviewer ("pagamento") além dos 4 core reviewers.
      fakeLlm.push(NO_FINDINGS, NO_FINDINGS, NO_FINDINGS, NO_FINDINGS, NO_FINDINGS);
      await customization.approvePlan(plan.id);
      const quote = await billing.quoteForPlan(plan.id);

      const purchase = await purchases.purchase({ customizationPlanId: plan.id, pricingQuoteId: quote.id });
      expect(purchase.status).toBe('CONFIRMED');
      expect(purchase.derivedProjectId).toBeTruthy();
      expect(purchase.generation.status).toBe('SUCCEEDED');

      // MISSÃO "Targeted Generation": asIs = zero mudanças classificadas -> reaproveitamento total
      // real das decisões de stack/arquitetura/equipe já aprovadas para a solução de referência
      // (nunca "gerar tudo de novo" para uma compra "como está").
      expect(purchase.generation.generationMode).toBe('TARGETED');
      expect(purchase.generation.impactScore).toBe(1);
      expect(purchase.generation.reusedRequirements).toBe(purchase.generation.totalRequirements);
      expect(purchase.generation.totalRequirements).toBeGreaterThan(0);

      const scope = await prisma.marketplaceGenerationScope.findUnique({ where: { customizationPlanId: plan.id } });
      expect(scope?.generationMode).toBe('TARGETED');
      expect(scope?.requiresStackReselection).toBe(false);
      expect(scope?.requiresArchitectureRecompute).toBe(false);
      expect(scope?.requiresTeamRecompute).toBe(false);
      const actualReuse = scope?.actualReuseJson as { reuseStackSelection: boolean; reuseArchitecture: boolean; reuseTeam: boolean } | null;
      expect(actualReuse).toEqual({ reuseStackSelection: true, reuseArchitecture: true, reuseTeam: true });
      expect(scope?.escalationsJson).toEqual([]);

      // Reaproveitamento real, não só um rótulo: a mesma stack/arquitetura/equipe já aprovadas
      // para a missão de referência aparecem de verdade na mission derivada.
      const referenceResult = await prisma.generationResult.findUnique({ where: { missionId: referenceMissionId } });
      const derivedResult = await prisma.generationResult.findUnique({ where: { missionId: plan.missionId } });
      const referenceStacks = (referenceResult?.resultJson as { approvedSolution: { selectedStacks: { stackKey: string }[] } }).approvedSolution.selectedStacks.map((s) => s.stackKey).sort();
      const derivedStacks = (derivedResult?.resultJson as { approvedSolution: { selectedStacks: { stackKey: string }[] } }).approvedSolution.selectedStacks.map((s) => s.stackKey).sort();
      expect(derivedStacks).toEqual(referenceStacks);

      const project = await prisma.project.findUnique({ where: { id: purchase.derivedProjectId! } });
      expect(project?.sourceSolutionId).toBe(solutionId);
      expect(project?.purchaseId).toBe(purchase.id);

      const projectMission = await prisma.projectMission.findUnique({ where: { missionId: plan.missionId } });
      expect(projectMission?.projectId).toBe(purchase.derivedProjectId);

      // Cotação expirada nunca é aceita.
      await prisma.marketplacePricingQuote.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
      await expect(purchases.purchase({ customizationPlanId: plan.id, pricingQuoteId: quote.id })).rejects.toThrow('MARKETPLACE_PRICING_QUOTE_EXPIRED');

      await prisma.project.deleteMany({ where: { id: purchase.derivedProjectId! } });
      await prisma.marketplacePurchase.deleteMany({ where: { id: purchase.id } });
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  // MISSÃO "Targeted Generation no Marketplace" — reaproveitar decisões de planejamento já
  // governadas (stack/arquitetura/equipe) em vez de redecidir tudo do zero a cada compra.

  it('um MODULE novo recompõe arquitetura/equipe de verdade, mas ainda tenta reaproveitar a stack (nunca FULL sem necessidade)', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas.', keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [], add: [{ section: 'features', content: 'Gestão de vendedores externos', type: 'MODULE' }],
          missingInformation: [], assumptions: [], confidence: 0.85,
        })
      );
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas, sem RH, com vendedores externos.' });
      expect(plan.complexity).toBe('LOW'); // 2 mudanças, sem DATA_MODEL/INTEGRATION -> nunca HIGH

      fakeLlm.push(NO_FINDINGS, NO_FINDINGS, NO_FINDINGS, NO_FINDINGS); // core reviewers
      await customization.approvePlan(plan.id);
      const quote = await billing.quoteForPlan(plan.id);
      const purchase = await purchases.purchase({ customizationPlanId: plan.id, pricingQuoteId: quote.id });

      expect(purchase.generation.status).toBe('SUCCEEDED');
      expect(purchase.generation.generationMode).toBe('TARGETED'); // impacto real, mas não "explosivo" -> nunca FULL

      const scope = await prisma.marketplaceGenerationScope.findUnique({ where: { customizationPlanId: plan.id } });
      expect(scope?.changeClassesJson).toEqual(['MODULE']);
      expect(scope?.requiresArchitectureRecompute).toBe(true);
      expect(scope?.requiresTeamRecompute).toBe(true);
      const actualReuse = scope?.actualReuseJson as { reuseStackSelection: boolean; reuseArchitecture: boolean; reuseTeam: boolean } | null;
      // A stack ainda foi TENTADA (mesmos delivery targets da referência) — só arquitetura/equipe
      // foram recompostas de verdade, nunca a mission inteira do zero.
      expect(actualReuse?.reuseStackSelection).toBe(true);
      expect(actualReuse?.reuseArchitecture).toBe(false);
      expect(actualReuse?.reuseTeam).toBe(false);

      await prisma.project.deleteMany({ where: { id: purchase.derivedProjectId! } });
      await prisma.marketplacePurchase.deleteMany({ where: { id: purchase.id } });
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Fase 26 — impacto grande demais (HIGH complexity) escala para FULL: nunca finge economia que não existe', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas com integração de logística.', keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [],
          add: [{ section: 'integrations', content: 'Integração com transportadora externa', type: 'INTEGRATION' }],
          missingInformation: [], assumptions: [], confidence: 0.8,
        })
      );
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas com integração de transportadora.' });
      expect(plan.complexity).toBe('HIGH'); // hasDataOrIntegration -> sempre HIGH, mesmo com poucas mudanças

      fakeLlm.push(NO_FINDINGS, NO_FINDINGS, NO_FINDINGS, NO_FINDINGS); // core reviewers
      await customization.approvePlan(plan.id);
      const quote = await billing.quoteForPlan(plan.id);
      const purchase = await purchases.purchase({ customizationPlanId: plan.id, pricingQuoteId: quote.id });

      expect(purchase.generation.status).toBe('SUCCEEDED');
      expect(purchase.generation.generationMode).toBe('FULL');

      const scope = await prisma.marketplaceGenerationScope.findUnique({ where: { customizationPlanId: plan.id } });
      expect(scope?.requiresStackReselection).toBe(true);
      expect(scope?.requiresArchitectureRecompute).toBe(true);
      expect(scope?.requiresTeamRecompute).toBe(true);
      const actualReuse = scope?.actualReuseJson as { reuseStackSelection: boolean; reuseArchitecture: boolean; reuseTeam: boolean } | null;
      expect(actualReuse).toEqual({ reuseStackSelection: false, reuseArchitecture: false, reuseTeam: false });

      await prisma.project.deleteMany({ where: { id: purchase.derivedProjectId! } });
      await prisma.marketplacePurchase.deleteMany({ where: { id: purchase.id } });
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  // MISSÃO "Completar o fluxo de compra/personalização do Marketplace" — o Review Council já
  // bloqueava corretamente; o que faltava era a UX real de resolução. Estes testes cobrem o ciclo
  // completo: auto-resolução, decisão real do comprador, rerun seletivo, loop guard e "comprar
  // como está" nunca pedindo ao comprador para consertar um defeito do publisher.

  it('approvePlan never throws a raw error for a real business-decision BLOCKER — it surfaces WAITING_USER, and the buyer resolving it via decideFinding advances the plan to APPROVED', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      // Fase 15 é sobre "comprar como está" (asIs) — este teste é sobre uma personalização REAL
      // com decisão de negócio pendente, então usa uma descrição real (não asIs) para nunca cair
      // no caminho de PUBLISHED_SOLUTION_REVIEW_DRIFT.
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas.', keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [], add: [], missingInformation: [], assumptions: [], confidence: 0.85,
          visionUpdate: null, objectiveUpdate: null, targetAudienceUpdate: null,
        })
      );
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas, sem RH.' });

      // Sem RH no contexto (removido) -> só os 4 core reviewers.
      fakeLlm.push(
        NO_FINDINGS, // requirements
        turn({
          findings: [
            {
              code: 'DOMAIN_MISMATCH', severity: 'BLOCKER', section: 'features', targetContent: [],
              finding: 'A visão do sistema ainda reflete o negócio original.',
              recommendedResolutions: ['Transformar completamente para o novo negócio', 'Manter estrutura original e só adicionar módulos'],
              requiresUserDecision: true,
            },
          ],
        }), // consistency
        NO_FINDINGS, // architectureFeasibility
        NO_FINDINGS // qa
      );

      const approved = await customization.approvePlan(plan.id);
      expect(approved.status).toBe('DRAFT'); // nunca lança erro técnico cru
      expect(approved.review?.status).toBe('WAITING_USER');
      expect(approved.review?.gate.passed).toBe(false);
      const blocker = approved.review!.findings.find((f) => f.code === 'DOMAIN_MISMATCH')!;
      expect(blocker.decisionOutcome).toBe('USER_DECISION_REQUIRED');
      expect(blocker.status).toBe('OPEN');

      // O comprador resolve pelo mesmo motor do Copilot — nunca precisa sair do Marketplace.
      fakeLlm.push(turn({
        summary: 'Mantendo estrutura original e adicionando módulos.',
        changes: [{ action: 'ADD', section: 'acceptanceCriteria', targetContent: null, newContent: 'Sistema mantém módulos originais além dos novos pedidos', reason: 'Decisão do comprador' }],
      }));
      const session = await review.decideFinding(plan.id, blocker.id, 'Manter estrutura original e adicionar módulos');
      expect(session.status).toBe('READY');
      expect(session.gate.passed).toBe(true);

      const finalPlan = await customization.getPlan(plan.id);
      expect(finalPlan.status).toBe('APPROVED');

      const decision = await prisma.promptMasterDecision.findFirst({ where: { missionId: plan.missionId, findingId: blocker.id } });
      expect(decision?.chosenOption).toContain('Manter estrutura original');

      const derivedPromptMaster = await prisma.promptMasterVersion.findFirst({ where: { missionId: plan.missionId } });
      expect(derivedPromptMaster?.status).toBe('LOCKED'); // imutável depois disso
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Auto-Repair Loop resolves a low-risk WARNING without asking the buyer, and only reruns the reviewer whose finding was actually touched', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, asIs: true });

      fakeLlm.push(
        turn({
          findings: [
            {
              code: 'VAGUE_ACCEPTANCE_WORDING', severity: 'WARNING', section: 'features', targetContent: ['Cadastro de clientes'],
              finding: 'Wording poderia ser mais claro.',
              recommendedResolutions: ['Deixar o texto mais específico'],
              requiresUserDecision: false,
            },
          ],
        }), // requirements
        NO_FINDINGS, // consistency
        NO_FINDINGS, // architectureFeasibility
        NO_FINDINGS, // qa
        NO_FINDINGS // security
      );

      // Auto-Repair Loop propõe o fix (motor do Copilot) e, como corrigiu de verdade, reroda só o
      // reviewer "requirements" — nunca os outros 4.
      fakeLlm.push(turn({
        summary: 'Deixando o wording mais específico.',
        changes: [{ action: 'EDIT', section: 'features', targetContent: 'Cadastro de clientes', newContent: 'Cadastro de clientes com CPF/CNPJ e histórico de compras', reason: 'Wording mais claro' }],
      }));
      fakeLlm.push(NO_FINDINGS); // retry do reviewer "requirements"

      const approved = await customization.approvePlan(plan.id);
      expect(approved.status).toBe('APPROVED');
      expect(approved.review?.autoResolvedCount).toBe(1);
      expect(approved.review?.findings.every((f) => f.status !== 'OPEN')).toBe(true);

      const finding = approved.review!.findings.find((f) => f.code === 'VAGUE_ACCEPTANCE_WORDING')!;
      expect(finding.resolvedBy).toBe('ai-auto-repair');

      const executions = await prisma.reviewerExecution.findMany({ where: { missionId: plan.missionId } });
      const byReviewer = executions.reduce<Record<string, number>>((acc, e) => ((acc[e.reviewerKey] = (acc[e.reviewerKey] ?? 0) + 1), acc), {});
      expect(byReviewer.requirements).toBe(2); // rodou de novo (afetado)
      expect(byReviewer.consistency).toBe(1); // nunca rerodado
      expect(byReviewer.architectureFeasibility).toBe(1);
      expect(byReviewer.qa).toBe(1);
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Fase 15/16: a genuine BLOCKER on an "as-is" purchase is never asked of the buyer — the published solution version is flagged for revalidation instead', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, asIs: true });
      expect(plan.asIs).toBe(true);

      fakeLlm.push(
        NO_FINDINGS, // requirements
        turn({
          findings: [
            {
              code: 'PUBLISHED_INCONSISTENCY', severity: 'BLOCKER', section: 'flows', targetContent: [],
              finding: 'Contradição real já existente na solução publicada.',
              recommendedResolutions: ['Revisar a solução publicada'],
              requiresUserDecision: true,
            },
          ],
        }), // consistency
        NO_FINDINGS, // architectureFeasibility
        NO_FINDINGS, // qa
        NO_FINDINGS // security
      );

      await expect(customization.approvePlan(plan.id)).rejects.toThrow('MARKETPLACE_PUBLISHED_SOLUTION_REVIEW_DRIFT');

      const rejectedPlan = await prisma.marketplaceCustomizationPlan.findUnique({ where: { id: plan.id } });
      expect(rejectedPlan?.status).toBe('REJECTED'); // nunca fica pendurado pedindo ao comprador pra consertar

      const version = await prisma.marketplaceSolutionVersion.findUnique({ where: { id: plan.solutionVersionId } });
      expect(version?.revalidationStatus).toBe('REVALIDATION_REQUIRED');
      expect(version?.revalidationNote).toContain('PUBLISHED_INCONSISTENCY');
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });

  it('Fase 12: repeated resume attempts on an unresolved decision never oscillate forever — REVIEW_LOOP_EXHAUSTED after the cap', async () => {
    const { solutionId, slug, referenceMissionId } = await seedVerifiedSolution();
    let plan;
    try {
      fakeLlm.push(
        turn({
          businessContext: 'Distribuidora de bebidas.', keep: ['Cadastro de clientes'],
          remove: [{ targetContent: 'Recursos humanos e folha de pagamento', type: 'MODULE' }],
          modify: [], add: [], missingInformation: [], assumptions: [], confidence: 0.85,
        })
      );
      plan = await customization.createCustomizationPlan({ solutionSlug: slug, rawBusinessDescription: 'Distribuidora de bebidas, sem RH.' });

      // Sem RH no contexto -> só os 4 core reviewers.
      fakeLlm.push(
        NO_FINDINGS, // requirements
        turn({
          findings: [{
            code: 'UNRESOLVED_DECISION', severity: 'BLOCKER', section: 'flows', targetContent: [],
            finding: 'Decisão real de negócio pendente.', recommendedResolutions: ['Opção A', 'Opção B'], requiresUserDecision: true,
          }],
        }), // consistency
        NO_FINDINGS, // architectureFeasibility
        NO_FINDINGS // qa
      );

      const first = await customization.approvePlan(plan.id);
      expect(first.review?.status).toBe('WAITING_USER');
      expect(first.review?.reviewAttemptCount).toBe(1);

      // 4 tentativas restantes até o teto (a 1ª já rodou dentro de approvePlan) — nunca resolvido,
      // então reviewAttemptCount sobe sem chamar a LLM de novo (nada auto-fixável pra tentar).
      let last = first.review!;
      for (let i = 0; i < 3; i++) {
        last = await review.runCycle(plan.id);
        expect(last.status).toBe('WAITING_USER');
      }
      expect(last.reviewAttemptCount).toBe(4);

      // A 5ª tentativa usa o último orçamento do teto — já sai como REVIEW_LOOP_EXHAUSTED (nunca
      // vai tentar de novo sozinho a partir daqui; o comprador ainda pode decidir manualmente).
      const fifth = await review.runCycle(plan.id);
      expect(fifth.reviewAttemptCount).toBe(5);
      expect(fifth.status).toBe('REVIEW_LOOP_EXHAUSTED');

      // Uma 6ª chamada nunca ultrapassa o teto nem tenta de novo.
      const exhausted = await review.runCycle(plan.id);
      expect(exhausted.status).toBe('REVIEW_LOOP_EXHAUSTED');
      expect(exhausted.reviewAttemptCount).toBe(5);

      // Fase 12/18 — o teto só trava tentativas AUTOMÁTICAS: uma decisão real do comprador
      // resolvendo o último BLOCKER ainda fecha o gate e aprova, mesmo depois de esgotado (nunca
      // deixa o comprador travado num REVIEW_LOOP_EXHAUSTED que ele mesmo já resolveu). Achado
      // validado ao vivo (real DeepSeek, ver relatório).
      const openFinding = exhausted.findings.find((f) => f.status === 'OPEN')!;
      fakeLlm.push(turn({
        summary: 'Registrando a decisão do comprador.',
        changes: [{ action: 'ADD', section: 'acceptanceCriteria', targetContent: null, newContent: 'Opção A aplicada conforme decisão do comprador', reason: 'Decisão do comprador' }],
      }));
      const resolvedSession = await review.decideFinding(plan.id, openFinding.id, 'Opção A');
      expect(resolvedSession.status).toBe('READY');
      expect(resolvedSession.reviewAttemptCount).toBe(5); // teto nunca ultrapassado, mesmo aprovando

      const finalPlan = await customization.getPlan(plan.id);
      expect(finalPlan.status).toBe('APPROVED');
    } finally {
      if (plan) await cleanupMission(plan.missionId);
      await cleanupSolution(solutionId);
      await cleanupMission(referenceMissionId);
    }
  });
});
