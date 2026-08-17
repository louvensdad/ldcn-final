import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

interface Fixture {
  missionId: string;
  requirementId: string;
  jobId: string;
  artifactId: string;
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-003 PromptMaster + ContextLoader (Postgres)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let contextLoader: ContextLoaderService;
  let promptMaster: PromptMasterService;
  const missionIdsToClean: string[] = [];
  const testAgentKeys: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
    contextLoader = new ContextLoaderService(prisma);
    const ledger = new LlmInvocationLedgerService(prisma);
    promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
  });

  afterAll(async () => {
    for (const missionId of missionIdsToClean) await cleanupMission(missionId);
    if (testAgentKeys.length > 0) {
      const defs = await prisma.agentDefinition.findMany({ where: { key: { in: testAgentKeys } } });
      const ids = defs.map((d) => d.id);
      if (ids.length > 0) {
        await prisma.agentDefVersion.deleteMany({ where: { agentDefinitionId: { in: ids } } });
        await prisma.agentDefinition.deleteMany({ where: { id: { in: ids } } });
      }
    }
    await prisma.unitDefinition.deleteMany({ where: { key: { startsWith: 'unit.test-core3.' } } });
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string): Promise<void> {
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.generatedArtifact.deleteMany({ where: { missionId } });
    await prisma.generationJob.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.architectureReview.deleteMany({ where: { missionId } });
    await prisma.discoveryConversation.deleteMany({ where: { missionId } });
  }

  /** Fixture de aceitação — doc CORE-003 §37: Mission "Demo API", Job "Health endpoint with
   * uptime", Requirement "GET /health → {status, uptimeSeconds}". */
  async function createFixture(overrides: { requirementContent?: string; targetFile?: string; missionSuffix?: string } = {}): Promise<Fixture> {
    const missionId = `test-core3-${overrides.missionSuffix ?? randomUUID()}`;
    missionIdsToClean.push(missionId);

    await prisma.discoveryConversation.create({
      data: { missionId, status: 'HANDED_OFF', rawUserIdea: 'Demo API', domain: 'api', goal: 'Expor um endpoint de health com uptime.' },
    });
    await prisma.architectureReview.create({
      data: { id: randomUUID(), missionId, approvedSolutionId: `sol-${missionId}`, architectureCompositionId: `comp-${missionId}`, status: 'APPROVED' },
    });

    const requirementId = randomUUID();
    await prisma.requirement.create({
      data: {
        id: requirementId,
        missionId,
        section: 'functional',
        content: overrides.requirementContent ?? 'GET /health deve retornar {"status": "ok", "uptimeSeconds": number}.',
        origin: 'AI_SUGGESTED',
        status: 'CONFIRMED',
        createdBy: 'test',
        updatedAt: new Date(),
      },
    });

    const targetFile = overrides.targetFile ?? 'src/health/health.controller.ts';
    const jobId = randomUUID();
    await prisma.generationJob.create({
      data: {
        id: jobId,
        missionId,
        generationRunId: `run-${missionId}`,
        requirementId,
        requirementText: overrides.requirementContent ?? 'GET /health deve retornar {"status": "ok", "uptimeSeconds": number}.',
        targetResource: 'Health',
        targetFile,
        agentKey: 'backend.nestjs.developer',
        status: 'PENDING',
      },
    });

    const artifactId = randomUUID();
    await prisma.generatedArtifact.create({
      data: {
        id: artifactId,
        missionId,
        generationRunId: `run-${missionId}`,
        path: targetFile,
        target: 'backend',
        pluginId: 'nestjs',
        ownerAgent: 'backend.nestjs.developer',
        version: 1,
        hash: 'fixture-hash-1',
        sizeBytes: 128,
        symbolsJson: ['HealthController'],
        importsJson: [],
        exportsJson: ['HealthController'],
        provenance: `requirement:${requirementId}`,
      },
    });

    return { missionId, requirementId, jobId, artifactId };
  }

  // A. ContextLoader carrega Mission/Job corretos.
  it('A: ContextLoader loads the correct Mission and Job', async () => {
    const fx = await createFixture();
    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    expect(context.missionId).toBe(fx.missionId);
    expect(context.jobId).toBe(fx.jobId);
    expect(context.job.targetFile).toBe('src/health/health.controller.ts');
    expect(context.mission.available).toBe(true);
  });

  // B. Mission A não acessa Job de Mission B.
  it('B: loading a Job that belongs to a different Mission is rejected', async () => {
    const fxA = await createFixture();
    const fxB = await createFixture();
    await expect(
      contextLoader.load({ missionId: fxA.missionId, jobId: fxB.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 })
    ).rejects.toThrow('CONTEXT_MISSION_MISMATCH');
  });

  // C. LoadedContext não contém credential.
  it('C: LoadedContext never contains credential-shaped content', async () => {
    const fx = await createFixture();
    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    const text = JSON.stringify(context).toLowerCase();
    for (const term of ['apikey', 'api_key', 'secret', 'credential', 'password']) expect(text).not.toContain(term);
  });

  // D. PromptMaster resolve AgentDefVersion exata.
  it('D: PromptMaster resolves the exact AgentDefVersion, never just current', async () => {
    const fx = await createFixture();
    const { compiled } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    expect(compiled.refs.agentDefinitionKey).toBe('backend.nestjs.developer');
    expect(compiled.refs.agentDefinitionVersion).toBe(1);

    await expect(
      promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 999, purpose: 'IMPLEMENTATION' })
    ).rejects.toThrow('CATALOG_AGENT_DEF_VERSION_NOT_FOUND');
  });

  // E. PromptMaster resolve PromptTemplate exata.
  it('E: PromptMaster resolves the exact PromptTemplate referenced by the AgentDefVersion', async () => {
    const fx = await createFixture();
    const { compiled } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    expect(compiled.refs.promptTemplateKey).toBe('nestjs.developer');
    expect(compiled.refs.promptTemplateVersion).toBe('v1');
  });

  // F. mesmos inputs produzem mesmo compiledPromptHash.
  it('F: identical inputs produce the identical compiledPromptHash', async () => {
    const fx = await createFixture();
    const first = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const second = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    expect(second.compiled.compiledPromptHash).toBe(first.compiled.compiledPromptHash);
    expect(second.compiled.contextHash).toBe(first.compiled.contextHash);
  });

  // G. mudança em Job relevante muda hash.
  it('G: a relevant change to the Job/Requirement changes the hash', async () => {
    const fxA = await createFixture({ requirementContent: 'GET /health original.' });
    const fxB = await createFixture({ requirementContent: 'GET /health com corpo totalmente diferente.' });
    const a = await promptMaster.compile({ missionId: fxA.missionId, jobId: fxA.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const b = await promptMaster.compile({ missionId: fxB.missionId, jobId: fxB.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    expect(a.compiled.compiledPromptHash).not.toBe(b.compiled.compiledPromptHash);
    expect(a.compiled.contextHash).not.toBe(b.compiled.contextHash);
  });

  // H. mudança de AgentDefVersion muda hash.
  it('H: a different AgentDefVersion (v1 vs v2 of the same agent) changes the hash', async () => {
    const key = `test-core3.versioning.${randomUUID()}`;
    testAgentKeys.push(key);
    await catalog.upsertUnit({ key: `unit.test-core3.${key}`, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey: `unit.test-core3.${key}` });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test Dev', seniority: 'MID' },
      roleMission: 'v1 mission',
      capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ChangeSetProposalV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    await catalog.publishVersion(key, 1);
    await catalog.createVersion(key, 2, {
      identity: { role: 'Test Dev', seniority: 'SENIOR' },
      roleMission: 'v2 mission — completely different',
      capabilityKeys: ['language.typescript', 'framework.nestjs'],
      promptTemplateKey: 'nestjs.developer',
      promptTemplateVersion: 'v1',
      outputSchemaKey: 'ChangeSetProposalV1',
      boundaries: ['no-op'],
      cognitiveMode: 'COGNITIVE',
    });
    await catalog.publishVersion(key, 2);

    const fx = await createFixture();
    const v1 = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: key, agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const v2 = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: key, agentDefinitionVersion: 2, purpose: 'IMPLEMENTATION' });
    expect(v1.compiled.compiledPromptHash).not.toBe(v2.compiled.compiledPromptHash);
  });

  // I. developer e reviewer produzem prompts diferentes.
  it('I: developer@v1 and reviewer@v1 produce different CompiledPrompts for the same Job', async () => {
    const fx = await createFixture();
    const developer = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const reviewer = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.reviewer', agentDefinitionVersion: 1, purpose: 'REVIEW' });
    expect(developer.compiled.compiledPromptHash).not.toBe(reviewer.compiled.compiledPromptHash);
    expect(developer.compiled.renderedText).not.toBe(reviewer.compiled.renderedText);
    expect(developer.compiled.outputSchemaKey).toBe('ChangeSetProposalV1');
    expect(reviewer.compiled.outputSchemaKey).toBe('CodeReviewResultV1');
  });

  // J. developer e data-specialist produzem prompts diferentes.
  it('J: developer@v1 and data-specialist@v1 produce different CompiledPrompts for the same Job', async () => {
    const fx = await createFixture();
    const developer = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const dataSpecialist = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.data-specialist', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    expect(developer.compiled.compiledPromptHash).not.toBe(dataSpecialist.compiled.compiledPromptHash);
    expect(developer.compiled.renderedText).not.toBe(dataSpecialist.compiled.renderedText);
  });

  // K/L/M. Trust zones — ordem e delimitação.
  it('K/L/M: BOUNDARIES and OUTPUT_CONTRACT appear before delimited UNTRUSTED project content', async () => {
    const fx = await createFixture();
    const { compiled } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION' });
    const text = compiled.renderedText;

    const boundariesIndex = text.indexOf('## BOUNDARIES');
    const outputContractIndex = text.indexOf('## OUTPUT_CONTRACT');
    const untrustedIndex = text.indexOf('<<<UNTRUSTED_PROJECT_CONTEXT>>>');

    expect(boundariesIndex).toBeGreaterThanOrEqual(0);
    expect(outputContractIndex).toBeGreaterThanOrEqual(0);
    expect(untrustedIndex).toBeGreaterThan(0);
    expect(boundariesIndex).toBeLessThan(untrustedIndex);
    expect(outputContractIndex).toBeLessThan(untrustedIndex);

    // M: o conteúdo do Requirement (livre/do projeto) está dentro do delimitador.
    expect(text).toContain('<<<UNTRUSTED_PROJECT_CONTEXT>>>');
    expect(text).toContain('<<<END_UNTRUSTED_PROJECT_CONTEXT>>>');
    const openIdx = text.indexOf('<<<UNTRUSTED_PROJECT_CONTEXT>>>');
    const closeIdx = text.indexOf('<<<END_UNTRUSTED_PROJECT_CONTEXT>>>');
    const requirementSnippet = 'GET /health deve retornar';
    const requirementIdx = text.indexOf(requirementSnippet);
    expect(requirementIdx).toBeGreaterThan(openIdx);
    expect(requirementIdx).toBeLessThan(closeIdx);
  });

  // N. requirements vinculados aparecem no contexto.
  it('N: linked requirements appear in the loaded context', async () => {
    const fx = await createFixture();
    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    expect(context.requirements.map((r) => r.id)).toContain(fx.requirementId);
  });

  // O. requirements não relacionados não aparecem.
  it('O: unrelated requirements from the same Mission do not appear', async () => {
    const fx = await createFixture();
    const unrelatedRequirementId = randomUUID();
    await prisma.requirement.create({
      data: { id: unrelatedRequirementId, missionId: fx.missionId, section: 'functional', content: 'Requisito não relacionado a este Job.', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', updatedAt: new Date() },
    });
    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    expect(context.requirements.map((r) => r.id)).not.toContain(unrelatedRequirementId);
  });

  // P. artifacts não relacionados não aparecem.
  it('P: unrelated artifacts from the same Mission do not appear', async () => {
    const fx = await createFixture();
    const unrelatedArtifactId = randomUUID();
    await prisma.generatedArtifact.create({
      data: {
        id: unrelatedArtifactId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, path: 'src/unrelated/unrelated.service.ts',
        target: 'backend', pluginId: 'nestjs', ownerAgent: 'backend.nestjs.developer', version: 1, hash: 'unrelated-hash', sizeBytes: 10,
        symbolsJson: [], importsJson: [], exportsJson: [], provenance: 'scaffold',
      },
    });
    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    expect(context.artifacts.map((a) => a.id)).not.toContain(unrelatedArtifactId);
  });

  // Q. se obrigatório exceder budget: CONTEXT_OVERFLOW.
  it('Q: CONTEXT_OVERFLOW when the incompressible sections alone exceed the budget', async () => {
    const fx = await createFixture();
    await expect(
      promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION', budget: { maxEstimatedTokens: 5 } })
    ).rejects.toThrow('CONTEXT_OVERFLOW');
  });

  // R. truncamento de conteúdo opcional é determinístico.
  it('R: truncation of compressible sections is deterministic across runs', async () => {
    const fx = await createFixture();
    // Infla especificamente a seção compressível CODEBASE_CONTEXT (artifact symbols), nunca o
    // conteúdo incompressível (JOB/BOUNDARIES/etc, que continuam curtos).
    await prisma.generatedArtifact.update({
      where: { id: fx.artifactId },
      data: { symbolsJson: Array.from({ length: 4000 }, (_, i) => `HealthControllerSymbol_${i}`) },
    });
    const budget = { maxEstimatedTokens: 1000 };
    const first = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION', budget });
    const second = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION', budget });
    expect(second.compiled.renderedText).toBe(first.compiled.renderedText);
    const codebaseSection = first.compiled.sections.find((s) => s.name === 'CODEBASE_CONTEXT')!;
    expect(codebaseSection.truncated).toBe(true);
  });

  // S. PromptSnapshot não contém secret.
  it('S: the persisted PromptSnapshot never contains a credential-shaped value', async () => {
    const fx = await createFixture();
    const { promptSnapshotId } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION', persistSnapshot: true });
    const row = await prisma.promptSnapshot.findUnique({ where: { id: promptSnapshotId! } });
    const text = JSON.stringify(row).toLowerCase();
    for (const term of ['apikey', 'api_key', 'secret', 'credential', 'password']) expect(text).not.toContain(term);
  });

  // T. PromptSnapshot referencia agent version/template version/job/requirements/artifacts/output schema.
  it('T: the persisted PromptSnapshot references agent version, template version, job, requirements, artifacts and output schema', async () => {
    const fx = await createFixture();
    const { promptSnapshotId } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'IMPLEMENTATION', persistSnapshot: true });
    const row = await prisma.promptSnapshot.findUnique({ where: { id: promptSnapshotId! } });
    expect(row).not.toBeNull();
    expect(row!.agentDefinitionKey).toBe('backend.nestjs.developer');
    expect(row!.agentDefinitionVersion).toBe(1);
    expect(row!.promptTemplateKey).toBe('nestjs.developer');
    expect(row!.promptTemplateVersion).toBe('v1');
    expect(row!.jobId).toBe(fx.jobId);
    expect(row!.outputSchemaKey).toBe('ChangeSetProposalV1');
    expect((row!.requirementRefsJson as unknown as string[])).toContain(fx.requirementId);
    expect((row!.artifactRefsJson as unknown as string[])).toContain(fx.artifactId);
  });
});
