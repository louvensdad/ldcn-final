import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { AgentExecutionService } from '../generation-engine/agent-execution.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { GenerationEngineService } from '../generation-engine/generation-engine.service';
import { JobScopeService } from '../generation-engine/job-scope.service';
import { WorkspaceService } from '../generation-engine/workspace.service';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { canonicalHash } from '../generation-engine/canonical-hash';
import { RepositoryInspector } from '../generation-engine/repository-inspector';
import { DuplicateValidationService } from '../generation-engine/duplicate-validation.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queued: LlmCompletionResult[] = [];
  push(item: LlmCompletionResult): void { this.queued.push(item); }
  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeLlmClient: no queued response');
    return next;
  }
}
function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'fake-model', promptTokens: 50, completionTokens: 100 };
}
function analysisFixture(): Record<string, unknown> {
  return { understanding: 'GET /health endpoint.', affectedAreas: ['src/health/health.controller.ts'], risks: [], assumptions: [], ambiguities: [], confidence: 0.9 };
}
function planFixture(): Record<string, unknown> {
  return { steps: [{ order: 1, description: 'add handler', targetPaths: ['src/health/health.controller.ts'] }], expectedCreates: [], expectedModifies: ['src/health/health.controller.ts'], expectedReuses: [], validationPlan: [], confidence: 0.85 };
}
function changeSetFixture(requirementId: string, path: string, content = '// handler'): Record<string, unknown> {
  return { changes: [{ operation: 'MODIFY', path, content, rationale: 'add GET /health' }], requirementCoverageSummary: [{ requirementId, implementationNote: 'done' }], confidence: 0.8 };
}
function selfCheckFixture(requirementId: string, verdict: 'READY' | 'NEEDS_REPAIR' = 'READY'): Record<string, unknown> {
  return { verdict, findings: [], requirementCheck: [{ requirementId, status: verdict === 'READY' ? 'SATISFIED' : 'PARTIAL', evidenceSummary: 'ok' }], confidence: verdict === 'READY' ? 0.9 : 0.5 };
}

interface Fixture { missionId: string; requirementId: string; jobId: string }

(RUN_DB_TESTS ? describe : describe.skip)('CORE-007 JobScope + ScopeValidator (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let ledger: LlmInvocationLedgerService;
  let eventBus: EventBusService;
  let eventLog: EventLogService;
  let llm: FakeLlmClient;
  let runtime: AgentRuntimeService;
  let jobScopeService: JobScopeService;
  let contextLoader: ContextLoaderService;
  let promptMaster: PromptMasterService;
  let service: GenerationEngineService;
  let workspace: WorkspaceService;
  let workspaceValidationCalls: unknown[];
  const missionIdsToClean: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
    workspace = new WorkspaceService();
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    eventBus = new EventBusService();
    eventLog = new EventLogService(prisma, eventBus);
    ledger = new LlmInvocationLedgerService(prisma, eventLog);
    contextLoader = new ContextLoaderService(prisma);
    promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    const agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
    runtime = new AgentRuntimeService(prisma, catalog, contextLoader, agentExecution, eventLog);
    jobScopeService = new JobScopeService(prisma);
    const repositoryInspector = new RepositoryInspector(prisma, workspace);
    const duplicateValidation = new DuplicateValidationService(prisma, repositoryInspector);
    workspaceValidationCalls = [];
    service = new GenerationEngineService(
      prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, eventBus, catalog, runtime, eventLog, jobScopeService,
      duplicateValidation,
      { validate: async (input: unknown) => { workspaceValidationCalls.push(input); return { status: 'VALIDATED', errorCode: null }; } } as never
    );
  });

  afterAll(async () => {
    for (const missionId of missionIdsToClean) await cleanupMission(missionId);
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string): Promise<void> {
    await prisma.duplicateValidation.deleteMany({ where: { missionId } });
    await prisma.jobScopeValidation.deleteMany({ where: { missionId } });
    await prisma.jobScope.deleteMany({ where: { missionId } });
    await prisma.eventLog.deleteMany({ where: { missionId } });
    const instances = await prisma.agentInstance.findMany({ where: { missionId } });
    const instanceIds = instances.map((i) => i.id);
    if (instanceIds.length > 0) await prisma.agentRuntimeTimelineEvent.deleteMany({ where: { agentInstanceId: { in: instanceIds } } });
    await prisma.agentInstance.deleteMany({ where: { missionId } });
    const executions = await prisma.agentExecution.findMany({ where: { missionId } });
    const executionIds = executions.map((e) => e.id);
    if (executionIds.length > 0) await prisma.agentCognitiveStep.deleteMany({ where: { agentExecutionId: { in: executionIds } } });
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.agentExecution.deleteMany({ where: { missionId } });
    await prisma.generatedArtifact.deleteMany({ where: { missionId } });
    await prisma.generationJob.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.architectureReview.deleteMany({ where: { missionId } });
    await prisma.discoveryConversation.deleteMany({ where: { missionId } });
  }

  /** §36 — fixture de aceitação exata do documento. */
  async function createFixture(): Promise<Fixture> {
    const missionId = `test-core7-${randomUUID()}`;
    missionIdsToClean.push(missionId);
    await prisma.discoveryConversation.create({ data: { missionId, status: 'HANDED_OFF', rawUserIdea: 'Demo API', domain: 'api', goal: 'goal' } });
    await prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: `sol-${missionId}`, architectureCompositionId: `comp-${missionId}`, status: 'APPROVED' } });
    const requirementId = randomUUID();
    await prisma.requirement.create({
      data: { id: requirementId, missionId, section: 'businessRules', content: 'GET /health returns status=ok and uptimeSeconds.', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', updatedAt: new Date() },
    });
    const jobId = randomUUID();
    return { missionId, requirementId, jobId };
  }

  function queueHappyPath(fx: Fixture, targetFile: string): void {
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, targetFile)));
    llm.push(turn(selfCheckFixture(fx.requirementId)));
  }

  async function callAttemptStructuredJob(fx: Fixture, plannedJob: { requirementId: string; requirementText: string; targetResource: string; targetFile: string; agentKey: string }) {
    const indexed = await prisma.generatedArtifact.findFirst({ where: { missionId: fx.missionId, path: plannedJob.targetFile } });
    const fsPath = `${workspace.workspacePathFor(fx.missionId)}/${plannedJob.targetFile}`;
    if (!indexed && !(await workspace.pathExists(fsPath))) {
      const written = await workspace.writeWorkspaceFile(fx.missionId, plannedJob.targetFile, '// existing target');
      await prisma.generatedArtifact.create({
        data: {
          id: randomUUID(), missionId: fx.missionId, generationRunId: `run-${fx.missionId}`,
          path: plannedJob.targetFile, target: 'BACKEND', pluginId: 'nestjs', ownerAgent: plannedJob.agentKey,
          hash: written.hash, sizeBytes: written.sizeBytes, symbolsJson: [], importsJson: [], exportsJson: [], provenance: 'scaffold',
        },
      });
    }
    return (service as unknown as {
      attemptStructuredJob: (j: typeof plannedJob, m: string, r: { id: string }) => Promise<
        | { ok: true; jobId: string; agentExecutionId: string; updatedFileContent: string }
        | { ok: false; jobId: string; fallbackReason?: string; blocked?: boolean; agentExecutionId?: string | null; errorCode?: string }
      >;
    }).attemptStructuredJob(plannedJob, fx.missionId, { id: `run-${fx.missionId}` });
  }

  // A/B. JobScope persistido, ligado ao GenerationJob correto.
  it('A/B: ensureJobScope persists a JobScope row keyed to the correct GenerationJob', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: { id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, requirementId: fx.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    const scope = await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/health/**'] });
    expect(scope.generationJobId).toBe(fx.jobId);
    expect(scope.missionId).toBe(fx.missionId);
    const reloaded = await jobScopeService.getJobScope(fx.jobId);
    expect(reloaded!.id).toBe(scope.id);
  });

  // C. ContextLoader carrega JobScope.
  it('C: ContextLoader loads the canonical persisted JobScope', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: { id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, requirementId: fx.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/health/**', 'src/app.module.ts'], forbiddenPaths: ['.env'] });

    const context = await contextLoader.load({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1 });
    expect(context.jobScope.available).toBe(true);
    if (context.jobScope.available) {
      expect(context.jobScope.allowedPaths).toEqual(['src/health/**', 'src/app.module.ts']);
      expect(context.jobScope.forbiddenPaths).toEqual(['.env']);
      expect(context.jobScope.scopeHash).not.toBeNull();
    }
  });

  // D. PromptMaster JOB SCOPE usa scope canônico.
  it('D: the compiled prompt JOB_SCOPE section reflects the exact persisted scope', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: { id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, requirementId: fx.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    // Nota (achado desta CORE, documentado no relatório final): ContextLoaderService.
    // assertNoCredentials (CORE-003) faz match de substring largo em "secret" — um
    // forbiddenPaths legítimo tipo "secrets/**" dispara falso positivo (CONTEXT_CREDENTIAL_
    // NOT_ALLOWED). Evitado aqui deliberadamente (usa "private/**") sem tocar código do CORE-003.
    await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/health/**'], forbiddenPaths: ['.env', '.env.*', 'secrets/**'] });

    llm.push(turn(analysisFixture()));
    const { compiled } = await promptMaster.compile({ missionId: fx.missionId, jobId: fx.jobId, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, purpose: 'ANALYSIS' });
    expect(compiled.renderedText).toContain('src/health/**');
    expect(compiled.renderedText).toContain('secrets/**');
  });

  it('D2: ContextLoader credential scanner permits paths but rejects actual credential fields and values', () => {
    const scanner = contextLoader as unknown as { assertNoCredentials(value: unknown): void };
    expect(() => scanner.assertNoCredentials({ forbiddenPaths: ['secrets/**'], allowedPaths: ['src/credential-provider/**'], artifact: { path: 'src/auth/password-reset.service.ts' } })).not.toThrow();
    expect(() => scanner.assertNoCredentials({ apiKey: 'real-secret-value' })).toThrow('CONTEXT_CREDENTIAL_NOT_ALLOWED');
    expect(() => scanner.assertNoCredentials({ password: 'plaintext-password' })).toThrow('CONTEXT_CREDENTIAL_NOT_ALLOWED');
    expect(() => scanner.assertNoCredentials({ Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' })).toThrow('CONTEXT_CREDENTIAL_NOT_ALLOWED');
    expect(() => scanner.assertNoCredentials({ credential: { accessToken: 'token-value' } })).toThrow('CONTEXT_CREDENTIAL_NOT_ALLOWED');
  });

  // R/S. scope PASS permite materialização; evidence referencia scope exato.
  it('R/S: a valid ChangeSet PASSes scope validation, records evidence referencing the exact scope, and proceeds to materialization', async () => {
    const fx = await createFixture();
    queueHappyPath(fx, 'src/health/health.controller.ts');
    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await callAttemptStructuredJob(fx, plannedJob);

    expect(result.ok).toBe(true);
    expect(workspaceValidationCalls).toHaveLength(1);
    if (result.ok) {
      expect(result.updatedFileContent).toBe('// handler');
      const scope = await jobScopeService.getJobScope(result.jobId);
      const evidence = await prisma.jobScopeValidation.findFirst({ where: { generationJobId: result.jobId } });
      expect(evidence!.status).toBe('PASS');
      expect(evidence!.scopeHash).toBe(scope!.scopeHash);
      expect(evidence!.jobScopeId).toBe(scope!.id);
    }
  });

  // T. scope hash determinístico.
  it('T: scopeHash is deterministic for equal scope content regardless of key order', () => {
    const a = canonicalHash({ allowedPaths: ['x'], forbiddenPaths: [], allowedModules: [], allowedSymbols: [], requiredContracts: [], acceptanceCriteria: [] });
    const b = canonicalHash({ acceptanceCriteria: [], requiredContracts: [], allowedSymbols: [], allowedModules: [], forbiddenPaths: [], allowedPaths: ['x'] });
    expect(a).toBe(b);
  });

  // U. scope usado por execução não muda silenciosamente.
  it('U: ensureJobScope is idempotent — re-invoking never mutates the already-persisted scope', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: { id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, requirementId: fx.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    const first = await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/health/**'] });
    const second = await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/completely-different/**'] });
    expect(second.id).toBe(first.id);
    expect(second.scopeHash).toBe(first.scopeHash); // segunda chamada nunca sobrescreve — mesmo passando allowedPaths diferentes.
  });

  // W. legacy path também valida targetFile (mesma policy, mesmo ScopeValidator).
  it('W: the exact scope-check logic used by the legacy branch passes for a well-formed targetFile and would reject a malformed one', () => {
    const { ScopeValidator } = require('../generation-engine/scope-validator');
    const validator = new ScopeValidator();
    const targetFile = 'src/vendedores/vendedores.service.ts';
    const legit = validator.validate({ allowedPaths: [targetFile], forbiddenPaths: [] }, [{ operation: 'MODIFY', path: targetFile }]);
    expect(legit.status).toBe('PASS');

    const malformed = '../outside.ts';
    const bad = validator.validate({ allowedPaths: [malformed], forbiddenPaths: [] }, [{ operation: 'MODIFY', path: malformed }]);
    expect(bad.status).toBe('SCOPE_VIOLATION');
  });

  // Z. JOB_SCOPE_REQUIRED existe como defesa explícita (mesmo não sendo alcançável via
  // attemptStructuredJob, que sempre garante um scope antes).
  it('Z: requireJobScope throws JOB_SCOPE_REQUIRED for a Job with no persisted scope', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: { id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, requirementId: fx.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    await expect(jobScopeService.requireJobScope(fx.jobId)).rejects.toThrow('JOB_SCOPE_REQUIRED');
  });

  // AA/AB. scope PASS/FAIL emitem eventos reais.
  it('AA: a PASSing scope validation emits job.scope_validation_started + job.scope_validation_passed', async () => {
    const fx = await createFixture();
    queueHappyPath(fx, 'src/health/health.controller.ts');
    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await callAttemptStructuredJob(fx, plannedJob);
    expect(result.ok).toBe(true);

    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    const types = events.map((e) => e.type);
    expect(types).toContain('job.scope_validation_started');
    expect(types).toContain('job.scope_validation_passed');
    expect(types).not.toContain('job.scope_validation_failed');
  });

  it('AB/P/Q/X: a scope-violating ChangeSet is blocked (non-fallbackable), emits job.scope_validation_failed, never touches GeneratedArtifact or the filesystem', async () => {
    const fx = await createFixture();
    const missionWorkspace = workspace.workspacePathFor(fx.missionId);
    await workspace.writeFiles(fx.missionId, [{ path: 'src/health/health.controller.ts', content: '// original scaffold content', ownerAgent: 'scaffold', symbols: [], imports: [], exports: [], provenance: 'scaffold' } as never]);
    const originalContent = await workspace.readWorkspaceFile(fx.missionId, 'src/health/health.controller.ts');

    await prisma.generatedArtifact.create({
      data: { id: randomUUID(), missionId: fx.missionId, generationRunId: `run-${fx.missionId}`, path: 'src/health/health.controller.ts', target: 'backend', pluginId: 'nestjs', ownerAgent: 'scaffold', version: 1, hash: 'original-hash', sizeBytes: 10, symbolsJson: [], importsJson: [], exportsJson: [], provenance: 'scaffold' },
    });
    const artifactsBefore = await prisma.generatedArtifact.findMany({ where: { missionId: fx.missionId } });

    // Agente cognitivo tenta propor uma mudança FORA do próprio targetFile (path diferente) —
    // exatamente o cenário que o ScopeValidator existe pra pegar.
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/users/users.service.ts'))); // fora do scope!
    llm.push(turn(selfCheckFixture(fx.requirementId)));

    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await callAttemptStructuredJob(fx, plannedJob);

    // X: NON-FALLBACKABLE — blocked:true, nunca um simples fallbackReason genérico.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe(true);
      expect(result.errorCode).toBe('SCOPE_VIOLATION');
    }

    // P: nenhum novo artifact / mesma contagem e hash.
    const artifactsAfter = await prisma.generatedArtifact.findMany({ where: { missionId: fx.missionId } });
    expect(artifactsAfter).toHaveLength(artifactsBefore.length);
    expect(artifactsAfter[0].hash).toBe(artifactsBefore[0].hash);

    // Q: nenhum arquivo físico alterado.
    const contentAfter = await workspace.readWorkspaceFile(fx.missionId, 'src/health/health.controller.ts');
    expect(contentAfter).toBe(originalContent);

    // AB: evento de falha real.
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    expect(events.map((e) => e.type)).toContain('job.scope_validation_failed');
    expect(events.map((e) => e.type)).not.toContain('job.scope_validation_passed');
    expect(events.map((e) => e.type)).not.toContain('job.repository_inspection_started');
    expect(await prisma.duplicateValidation.count({ where: { missionId: fx.missionId } })).toBe(0);
    expect(workspaceValidationCalls).toHaveLength(0);

    await workspace.pathExists(missionWorkspace); // sanity: workspace realmente existe no disco.
  });

  it('CORE-008 structured guard: duplicate policy failure is non-fallbackable and occurs after scope PASS without writes', async () => {
    const fx = await createFixture();
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn({
      changes: [{ operation: 'CREATE', path: 'src/health/health.controller.ts', content: '// replacement', rationale: 'incorrect CREATE' }],
      requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: 'done' }], confidence: 0.8,
    }));
    llm.push(turn(selfCheckFixture(fx.requirementId)));
    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await callAttemptStructuredJob(fx, plannedJob);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe(true);
      expect(result.errorCode).toBe('MODIFY_REQUIRED');
    }
    expect(await workspace.readWorkspaceFile(fx.missionId, plannedJob.targetFile)).toBe('// existing target');
    const evidence = await prisma.duplicateValidation.findFirst({ where: { missionId: fx.missionId } });
    expect(evidence?.status).toBe('MODIFY_REQUIRED');
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } });
    const types = events.map((event) => event.type);
    expect(types.indexOf('job.scope_validation_passed')).toBeLessThan(types.indexOf('job.repository_inspection_started'));
    expect(types).toContain('job.repository_inspection_completed');
    expect(types).toContain('job.duplicate_validation_failed');
    expect(types).not.toContain('job.duplicate_validation_passed');
    expect(workspaceValidationCalls).toHaveLength(0);
  });

  it('CORE-008 legacy-shaped guard: persisted JobScope feeds repository validation and emits PASS before write', async () => {
    const fx = await createFixture();
    await prisma.generationJob.create({
      data: {
        id: fx.jobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}`,
        requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health',
        targetFile: 'src/health/health.controller.ts', agentKey: 'legacy.agent', status: 'PENDING',
      },
    });
    const written = await workspace.writeWorkspaceFile(fx.missionId, 'src/health/health.controller.ts', '// legacy current');
    await prisma.generatedArtifact.create({
      data: {
        id: randomUUID(), missionId: fx.missionId, generationRunId: `run-${fx.missionId}`,
        path: 'src/health/health.controller.ts', target: 'BACKEND', pluginId: 'nestjs', ownerAgent: 'legacy.agent',
        hash: written.hash, sizeBytes: written.sizeBytes, symbolsJson: [], importsJson: [], exportsJson: [], provenance: 'scaffold',
      },
    });
    const scope = await jobScopeService.ensureJobScope({ missionId: fx.missionId, generationJobId: fx.jobId, allowedPaths: ['src/health/health.controller.ts'] });
    const guard = await (service as unknown as {
      runRepositoryGuard(input: { missionId: string; generationJobId: string; jobScope: typeof scope; changes: { operation: 'MODIFY'; path: string; content: string }[] }): Promise<{ status: string }>;
    }).runRepositoryGuard({
      missionId: fx.missionId, generationJobId: fx.jobId, jobScope: scope,
      changes: [{ operation: 'MODIFY', path: 'src/health/health.controller.ts', content: '// legacy proposed' }],
    });
    expect(guard.status).toBe('PASS');
    const evidence = await prisma.duplicateValidation.findFirst({ where: { generationJobId: fx.jobId } });
    expect(evidence?.agentExecutionId).toBeNull();
    expect(evidence?.status).toBe('PASS');
    const types = (await prisma.eventLog.findMany({ where: { missionId: fx.missionId } })).map((event) => event.type);
    expect(types).toEqual(expect.arrayContaining(['job.repository_inspection_started', 'job.repository_inspection_completed', 'job.duplicate_validation_passed']));
    expect(await workspace.readWorkspaceFile(fx.missionId, 'src/health/health.controller.ts')).toBe('// legacy current');
  });

  // O (all-or-nothing) via camada de integração completa: 2 changes válidas + 1 inválida.
  it('mixed ChangeSet (2 in-scope + 1 out-of-scope) blocks the whole Job — all-or-nothing at the integration level', async () => {
    const fx = await createFixture();
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(
      turn({
        changes: [
          { operation: 'MODIFY', path: 'src/health/health.controller.ts', content: 'a', rationale: 'r1' },
          { operation: 'NO_CHANGE', path: 'src/health/health.controller.ts', rationale: 'r2' },
          { operation: 'CREATE', path: 'src/users/users.service.ts', content: 'b', rationale: 'r3' },
        ],
        requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: 'done' }],
        confidence: 0.8,
      })
    );
    llm.push(turn(selfCheckFixture(fx.requirementId)));

    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await callAttemptStructuredJob(fx, plannedJob);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blocked).toBe(true);

    const evidence = await prisma.jobScopeValidation.findFirst({ where: { generationJobId: result.jobId } });
    expect(evidence!.status).toBe('SCOPE_VIOLATION');
    const findings = evidence!.findingsJson as unknown as { path: string }[];
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe('src/users/users.service.ts');
  });

  // AC. event payload não contém source code/credential.
  it('AC: scope validation event payloads never contain source code or credential-shaped values', async () => {
    const fx = await createFixture();
    queueHappyPath(fx, 'src/health/health.controller.ts');
    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    await callAttemptStructuredJob(fx, plannedJob);

    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId, type: { startsWith: 'job.scope_validation' } } });
    expect(events.length).toBeGreaterThan(0);
    const text = JSON.stringify(events).toLowerCase();
    for (const term of ['apikey', 'secret', 'credential', 'password']) expect(text).not.toContain(term);
    for (const event of events) {
      const payload = event.payloadJson as Record<string, unknown>;
      expect(payload).not.toHaveProperty('content');
      expect(payload).not.toHaveProperty('changes');
    }
  });

  // AD. Mission isolation preservada para JobScope/JobScopeValidation.
  it('AD: JobScope and JobScopeValidation are correctly scoped by missionId', async () => {
    const fxA = await createFixture();
    const fxB = await createFixture();
    await prisma.generationJob.create({ data: { id: fxA.jobId, missionId: fxA.missionId, generationRunId: `run-${fxA.missionId}`, requirementId: fxA.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' } });
    await prisma.generationJob.create({ data: { id: fxB.jobId, missionId: fxB.missionId, generationRunId: `run-${fxB.missionId}`, requirementId: fxB.requirementId, requirementText: 'x', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' } });
    await jobScopeService.ensureJobScope({ missionId: fxA.missionId, generationJobId: fxA.jobId, allowedPaths: ['src/health/**'] });
    await jobScopeService.ensureJobScope({ missionId: fxB.missionId, generationJobId: fxB.jobId, allowedPaths: ['src/other/**'] });

    const scopesA = await prisma.jobScope.findMany({ where: { missionId: fxA.missionId } });
    expect(scopesA).toHaveLength(1);
    expect(scopesA[0].generationJobId).toBe(fxA.jobId);
    expect(scopesA.some((s) => s.generationJobId === fxB.jobId)).toBe(false);
  });
});
