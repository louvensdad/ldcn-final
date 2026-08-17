import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { MissionPersistenceService } from '../persistence/mission-persistence.service';
import { ReviewFindingService } from '../review/review-finding.service';
import { MarketplaceSolutionService } from '../marketplace/marketplace-solution.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

(RUN_DB_TESTS ? describe : describe.skip)('MarketplaceSolutionService (Postgres)', () => {
  let prisma: PrismaService;
  let missionPersistence: MissionPersistenceService;
  let reviewFindings: ReviewFindingService;
  let marketplace: MarketplaceSolutionService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    missionPersistence = new MissionPersistenceService(prisma);
    reviewFindings = new ReviewFindingService(prisma);
    marketplace = new MarketplaceSolutionService(prisma, missionPersistence, reviewFindings);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string) {
    await prisma.reviewFinding.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.promptMasterVersion.deleteMany({ where: { missionId } });
    await prisma.generationResult.deleteMany({ where: { missionId } });
    await prisma.generatorMissionState.deleteMany({ where: { missionId } });
  }

  async function cleanupSolution(solutionId: string) {
    const versions = await prisma.marketplaceSolutionVersion.findMany({ where: { solutionId } });
    await prisma.marketplaceSolutionVersion.deleteMany({ where: { solutionId } });
    await prisma.marketplaceSolution.deleteMany({ where: { id: solutionId } });
    return versions;
  }

  // Precisa de sinais léxicos reais ("API", "backend", "dashboard") para o TopologyResolver
  // determinístico inferir delivery targets de verdade — uma ideia vaga como "quero um ERP"
  // sozinha não basta (confirmado ao vivo: produz deliveryTargets/selectedStacks vazios).
  const RICH_ERP_IDEA = 'Quero um sistema ERP com API backend e dashboard administrativo para gerenciar clientes, produtos e estoque de uma distribuidora';

  /** Gera uma missão real via o engine determinístico (sem LLM — generate() é puramente
   * determinístico, mesmo padrão de repair-persistence.service.test.ts), depois trava um
   * PromptMasterVersion real com uma feature confirmada para servir de referência. */
  async function seedReferenceMission(missionId: string, rawUserIdea: string = RICH_ERP_IDEA): Promise<{ promptMasterId: string; featureId: string }> {
    const session = await missionPersistence.hydrate(missionId);
    session.commands.generate({ missionId, rawUserIdea });
    await missionPersistence.flush(missionId, session);

    const promptMasterId = randomUUID();
    await prisma.promptMasterVersion.create({
      data: {
        id: promptMasterId, missionId, version: 1,
        vision: 'ERP para distribuidoras', objective: 'Gerenciar clientes, produtos e estoque',
        targetAudience: 'Distribuidoras de médio porte', fullMarkdown: '# ERP Enterprise\nDocumento de referência.',
        hash: 'x', status: 'LOCKED', provider: 'deepseek', model: 'deepseek-chat',
        promptTokens: 0, completionTokens: 0, latencyMs: 0, lockedAt: new Date(),
      },
    });
    const featureId = randomUUID();
    await prisma.requirement.create({
      data: {
        id: featureId, missionId, promptMasterId, section: 'features', content: 'Cadastro de clientes',
        origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', approvedBy: 'user', approvedAt: new Date(),
      },
    });
    return { promptMasterId, featureId };
  }

  it('creates a solution in DRAFT, rejects a duplicate slug', async () => {
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      expect(solution.status).toBe('DRAFT');
      expect(solution.visibility).toBe('PRIVATE');
      await expect(
        marketplace.createSolution({ slug, name: 'Outro', description: 'x', publisherId: 'ldcn-core', category: 'templates' })
      ).rejects.toThrow('MARKETPLACE_SOLUTION_SLUG_TAKEN');
    } finally {
      await cleanupSolution(solution.id);
    }
  });

  it('createVersionFromMission requires a LOCKED reference PromptMaster and a generated mission — builds a real manifest from real architecture decisions', async () => {
    const missionId = `test-${randomUUID()}`;
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      // Sem PromptMaster travado ainda.
      await expect(
        marketplace.createVersionFromMission(solution.id, { referenceMissionId: missionId, basePrice: 100000 })
      ).rejects.toThrow('MARKETPLACE_REFERENCE_PROMPTMASTER_NOT_LOCKED');

      const { featureId } = await seedReferenceMission(missionId);

      const version = await marketplace.createVersionFromMission(solution.id, {
        referenceMissionId: missionId,
        basePrice: 250000,
        removableCapabilities: ['RH'],
      });

      expect(version.version).toBe(1);
      expect(version.status).toBe('DRAFT');
      expect(version.manifest.capabilities).toContain('Cadastro de clientes');
      expect(version.manifest.removableCapabilities).toEqual(['RH']);
      // Targets/stack vêm de decisões reais do Architecture Office, nunca fabricados.
      const anyTargetEnabled = version.manifest.targets.backend.enabled || version.manifest.targets.frontend.enabled;
      expect(anyTargetEnabled).toBe(true);
      expect(version.pricingSnapshot.basePrice).toBe(250000);
      expect(version.checksum).toBeTruthy();
      expect(featureId).toBeTruthy();
    } finally {
      await cleanupSolution(solution.id);
      await cleanupMission(missionId);
    }
  });

  it('Verification Gate: VERIFIED when everything real checks out — never fabricates PASSED for build/test/runtime that do not exist in this system', async () => {
    const missionId = `test-${randomUUID()}`;
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      await seedReferenceMission(missionId);
      const version = await marketplace.createVersionFromMission(solution.id, { referenceMissionId: missionId, basePrice: 250000 });

      const result = await marketplace.runVerificationGate(version.id);
      expect(result.status).toBe('VERIFIED');
      const byCode = Object.fromEntries(result.checks.map((c) => [c.code, c]));
      expect(byCode.REFERENCE_PROMPTMASTER_LOCKED.passed).toBe(true);
      expect(byCode.NO_UNRESOLVED_REVIEW_BLOCKERS.passed).toBe(true);
      expect(byCode.MANIFEST_HAS_TARGET.passed).toBe(true);
      expect(byCode.MANIFEST_HAS_CAPABILITIES.passed).toBe(true);
      expect(byCode.NO_EMBEDDED_SECRETS.passed).toBe(true);
      // Honestidade: build/test/runtime/preview nunca aparecem como uma verificação real —
      // aparecem explicitamente marcados como indisponíveis neste sistema.
      expect(byCode.BUILD_NOT_APPLICABLE.detail).toContain('não tem runtime');
      expect(byCode.AUTOMATED_TESTS_NOT_APPLICABLE.detail).toContain('não tem runtime');

      const persisted = await marketplace.getVersion(version.id);
      expect(persisted.status).toBe('VERIFIED');
      expect(persisted.validationSnapshot?.status).toBe('VERIFIED');
    } finally {
      await cleanupSolution(solution.id);
      await cleanupMission(missionId);
    }
  });

  it('Verification Gate: REJECTED when a secret is embedded in requirement content — MARKETPLACE_SECRET_DETECTED never publishes', async () => {
    const missionId = `test-${randomUUID()}`;
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      const { promptMasterId } = await seedReferenceMission(missionId);
      await prisma.requirement.create({
        data: {
          id: randomUUID(), missionId, promptMasterId, section: 'integrations',
          content: 'Integração com API externa usando api_key: "sk-abcdef1234567890abcdef"',
          origin: 'AI_REFINED', status: 'CONFIRMED', createdBy: 'test',
        },
      });

      const version = await marketplace.createVersionFromMission(solution.id, { referenceMissionId: missionId, basePrice: 250000 });
      const result = await marketplace.runVerificationGate(version.id);

      expect(result.status).toBe('REJECTED');
      const byCode = Object.fromEntries(result.checks.map((c) => [c.code, c]));
      expect(byCode.NO_EMBEDDED_SECRETS.passed).toBe(false);
      expect(byCode.NO_EMBEDDED_SECRETS.detail).toContain('OPENAI_STYLE_KEY');

      await expect(marketplace.publishVersion(version.id)).rejects.toThrow('MARKETPLACE_SOLUTION_VERSION_NOT_VERIFIED');
    } finally {
      await cleanupSolution(solution.id);
      await cleanupMission(missionId);
    }
  });

  it('Verification Gate: REJECTED when there is an unresolved BLOCKER — publish blocked', async () => {
    const missionId = `test-${randomUUID()}`;
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      const { promptMasterId } = await seedReferenceMission(missionId);
      await reviewFindings.create({
        missionId, promptMasterId, reviewerKey: 'consistency', code: 'REAL_BLOCKER', severity: 'BLOCKER',
        finding: 'Contradição real não resolvida.', recommendedResolutions: ['Opção A'], requiresUserDecision: true,
      });

      const version = await marketplace.createVersionFromMission(solution.id, { referenceMissionId: missionId, basePrice: 250000 });
      const result = await marketplace.runVerificationGate(version.id);

      expect(result.status).toBe('REJECTED');
      const byCode = Object.fromEntries(result.checks.map((c) => [c.code, c]));
      expect(byCode.NO_UNRESOLVED_REVIEW_BLOCKERS.passed).toBe(false);

      await expect(marketplace.publishVersion(version.id)).rejects.toThrow('MARKETPLACE_SOLUTION_VERSION_NOT_VERIFIED');
    } finally {
      await cleanupSolution(solution.id);
      await cleanupMission(missionId);
    }
  });

  it('publishVersion sets the solution VERIFIED/PUBLIC and points currentVersionId at the published version', async () => {
    const missionId = `test-${randomUUID()}`;
    const slug = `erp-test-${randomUUID()}`;
    const solution = await marketplace.createSolution({
      slug, name: 'ERP Enterprise', description: 'ERP modular', publisherId: 'ldcn-core', category: 'templates',
    });
    try {
      await seedReferenceMission(missionId);
      const version = await marketplace.createVersionFromMission(solution.id, { referenceMissionId: missionId, basePrice: 250000 });
      await marketplace.runVerificationGate(version.id);

      const published = await marketplace.publishVersion(version.id);
      expect(published.status).toBe('VERIFIED');
      expect(published.visibility).toBe('PUBLIC');
      expect(published.currentVersionId).toBe(version.id);
      expect(published.publishedAt).not.toBeNull();

      const { solution: fetched, currentVersion } = await marketplace.getSolutionBySlug(slug);
      expect(fetched.status).toBe('VERIFIED');
      expect(currentVersion?.id).toBe(version.id);
    } finally {
      await cleanupSolution(solution.id);
      await cleanupMission(missionId);
    }
  });
});
