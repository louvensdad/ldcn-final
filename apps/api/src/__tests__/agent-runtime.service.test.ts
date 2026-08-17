import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { AgentExecutionService } from '../generation-engine/agent-execution.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { assertTransition } from '../agent-runtime/fsm';
import { GenerationEngineService } from '../generation-engine/generation-engine.service';
import { JobScopeService } from '../generation-engine/job-scope.service';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queued: (LlmCompletionResult | 'FAIL' | 'INVALID_JSON')[] = [];
  onAfterComplete?: (callIndex: number) => Promise<void> | void;

  push(item: LlmCompletionResult | 'FAIL' | 'INVALID_JSON'): void {
    this.queued.push(item);
  }

  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const callIndex = this.calls.length;
    this.calls.push(input);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeLlmClient: no queued response');
    let result: LlmCompletionResult;
    if (next === 'FAIL') {
      if (this.onAfterComplete) await this.onAfterComplete(callIndex);
      throw new Error('simulated provider failure');
    }
    if (next === 'INVALID_JSON') result = { text: 'not json {{{', model: 'fake-model', promptTokens: 10, completionTokens: 10 };
    else result = next;
    if (this.onAfterComplete) await this.onAfterComplete(callIndex);
    return result;
  }
}

function turn(json: Record<string, unknown>): LlmCompletionResult {
  return { text: JSON.stringify(json), model: 'fake-model', promptTokens: 50, completionTokens: 100 };
}

function analysisFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    understanding: 'O Job pede um endpoint GET /health que retorna status e uptime.',
    affectedAreas: ['src/health/health.controller.ts'],
    risks: [{ description: 'Nenhum risco relevante identificado.', severity: 'LOW' }],
    assumptions: [], ambiguities: [], confidence: 0.9, ...overrides,
  };
}
function planFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    steps: [{ order: 1, description: 'Adicionar endpoint GET /health', targetPaths: ['src/health/health.controller.ts'] }],
    expectedCreates: [], expectedModifies: ['src/health/health.controller.ts'], expectedReuses: [],
    validationPlan: ['Chamar GET /health.'], confidence: 0.85, ...overrides,
  };
}
function changeSetFixture(requirementId: string, targetFile: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    changes: [{ operation: 'MODIFY', path: targetFile, content: '// handler content', rationale: 'Adiciona handler GET /health.' }],
    requirementCoverageSummary: [{ requirementId, implementationNote: 'Endpoint implementado.' }],
    confidence: 0.8, ...overrides,
  };
}
function selfCheckFixture(requirementId: string, verdict: 'READY' | 'NEEDS_REPAIR', overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    verdict,
    findings: verdict === 'READY' ? [] : [{ category: 'correctness', issue: 'uptimeSeconds ausente.', severity: 'MEDIUM' }],
    requirementCheck: [{ requirementId, status: verdict === 'READY' ? 'SATISFIED' : 'PARTIAL', evidenceSummary: 'evidência' }],
    confidence: verdict === 'READY' ? 0.9 : 0.5, ...overrides,
  };
}

interface Fixture {
  missionId: string;
  requirementId: string;
  jobId: string;
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-005 AgentRuntime FSM (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let ledger: LlmInvocationLedgerService;
  let llm: FakeLlmClient;
  let agentExecution: AgentExecutionService;
  let runtime: AgentRuntimeService;
  const missionIdsToClean: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
    const eventBus = new EventBusService();
    const eventLog = new EventLogService(prisma, eventBus);
    runtime = new AgentRuntimeService(prisma, catalog, contextLoader, agentExecution, eventLog);
  });

  afterAll(async () => {
    for (const missionId of missionIdsToClean) await cleanupMission(missionId);
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string): Promise<void> {
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

  /** §30 — mesma fixture de aceitação: Mission "Demo API", JOB-EX-001. */
  async function createFixture(overrides: { requirementContent?: string } = {}): Promise<Fixture> {
    const missionId = `test-core5-${randomUUID()}`;
    missionIdsToClean.push(missionId);

    await prisma.discoveryConversation.create({ data: { missionId, status: 'HANDED_OFF', rawUserIdea: 'Demo API', domain: 'api', goal: 'Expor um endpoint de health com uptime.' } });
    await prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: `sol-${missionId}`, architectureCompositionId: `comp-${missionId}`, status: 'APPROVED' } });

    const requirementId = randomUUID();
    await prisma.requirement.create({
      data: { id: requirementId, missionId, section: 'functional', content: overrides.requirementContent ?? 'GET /health deve retornar {"status": "ok", "uptimeSeconds": number}.', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', updatedAt: new Date() },
    });

    const jobId = randomUUID();
    await prisma.generationJob.create({
      data: { id: jobId, missionId, generationRunId: `run-${missionId}`, requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    await prisma.generatedArtifact.create({
      data: { id: randomUUID(), missionId, generationRunId: `run-${missionId}`, path: 'src/health/health.controller.ts', target: 'backend', pluginId: 'nestjs', ownerAgent: 'backend.nestjs.developer', version: 1, hash: 'fixture-hash', sizeBytes: 100, symbolsJson: ['HealthController'], importsJson: [], exportsJson: [], provenance: `requirement:${requirementId}` },
    });

    return { missionId, requirementId, jobId };
  }

  function queueHappyPath(fx: Fixture): void {
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'READY')));
  }

  // A. AgentInstance criado com versão exata.
  it('A: ensureInstance creates an AgentInstance with the exact frozen version', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    expect(instance.agentDefinitionKey).toBe('backend.nestjs.developer');
    expect(instance.agentDefinitionVersion).toBe(1);
    expect(instance.state).toBe('IDLE');

    const again = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    expect(again.id).toBe(instance.id); // idempotente
  });

  // B. summon cria ou associa AgentExecution.
  it('B: summon creates an AgentExecution linked to the AgentInstance', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('SUCCEEDED');
    const execution = await prisma.agentExecution.findUnique({ where: { id: outcome.agentExecutionId } });
    expect(execution!.agentInstanceId).toBe(instance.id);
  });

  // C-I. transições válidas + K/L timeline consistente.
  it('C-L: the full happy path follows the canonical FSM order with consistent timeline', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('SUCCEEDED');

    const timeline = await runtime.getTimeline(outcome.agentExecutionId);
    const transitions = timeline.filter((e) => e.toState !== null).map((e) => `${e.fromState}->${e.toState}`);
    expect(transitions).toEqual([
      'IDLE->SUMMONED',
      'SUMMONED->CONTEXT_LOADING',
      'CONTEXT_LOADING->ANALYZING',
      'ANALYZING->PLANNING',
      'PLANNING->IMPLEMENTING',
      'IMPLEMENTING->SELF_CHECKING',
      'SELF_CHECKING->COMPLETED',
    ]);

    const finalInstance = await prisma.agentInstance.findUnique({ where: { id: instance.id } });
    expect(finalInstance!.state).toBe('COMPLETED'); // L: state final == último toState do timeline.
    expect(finalInstance!.currentJobId).toBeNull(); // §15: nunca preso ao Job concluído.
    expect(finalInstance!.lastJobId).toBe(fx.jobId);
  });

  // J. transição inválida rejeitada.
  it('J: an invalid transition is rejected with AGENT_STATE_TRANSITION_INVALID', () => {
    expect(() => assertTransition('IDLE', 'COMPLETED')).toThrow('AGENT_STATE_TRANSITION_INVALID');
    expect(() => assertTransition('COMPLETED', 'ANALYZING')).toThrow('AGENT_STATE_TRANSITION_INVALID');
  });

  // M. nenhuma transaction fica aberta durante LLM.
  it('M: no $transaction is ever open while an LLM call is in flight', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);

    let llmInFlight = false;
    let violationDetected = false;
    const originalComplete = llm.complete.bind(llm);
    llm.complete = async (input) => {
      llmInFlight = true;
      try {
        return await originalComplete(input);
      } finally {
        llmInFlight = false;
      }
    };
    const originalTransaction = prisma.$transaction.bind(prisma);
    (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction = ((...args: Parameters<typeof prisma.$transaction>) => {
      if (llmInFlight) violationDetected = true;
      return (originalTransaction as (...a: unknown[]) => unknown)(...args);
    }) as typeof prisma.$transaction;

    try {
      const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
      expect(outcome.status).toBe('SUCCEEDED');
      expect(violationDetected).toBe(false);
    } finally {
      (prisma as unknown as { $transaction: typeof prisma.$transaction }).$transaction = originalTransaction;
    }
  });

  // N. Job Mission != Agent Mission rejeita.
  it('N: a Job belonging to a different Mission than the AgentInstance is rejected', async () => {
    const fxA = await createFixture();
    const fxB = await createFixture();
    const instanceA = await runtime.ensureInstance({ missionId: fxA.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    await expect(runtime.summon({ missionId: fxA.missionId, jobId: fxB.jobId, agentInstanceId: instanceA.id })).rejects.toThrow('AGENT_JOB_MISSION_MISMATCH');
  });

  // O. Agent busy rejeita segundo Job.
  it('O: summoning a busy AgentInstance for a different Job is rejected with AGENT_ALREADY_BUSY', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });

    // Segundo Job na mesma Mission, mesmo agentKey.
    const otherJobId = randomUUID();
    await prisma.generationJob.create({
      data: { id: otherJobId, missionId: fx.missionId, generationRunId: `run-${fx.missionId}-2`, requirementId: fx.requirementId, requirementText: 'outro job', targetResource: 'Other', targetFile: 'src/other/other.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });

    // Marca a instância como ocupada manualmente (simula um summon em andamento sem terminar).
    await prisma.agentInstance.update({ where: { id: instance.id }, data: { state: 'ANALYZING', currentJobId: fx.jobId } });

    await expect(runtime.summon({ missionId: fx.missionId, jobId: otherJobId, agentInstanceId: instance.id })).rejects.toThrow('AGENT_ALREADY_BUSY');
  });

  // P. double summon não duplica execução.
  it('P: a duplicate summon call for the same running instance+job returns the existing execution', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });

    // Simula uma execução RUNNING já em andamento pra mesma instância+job.
    await prisma.agentInstance.update({ where: { id: instance.id }, data: { state: 'ANALYZING', currentJobId: fx.jobId } });
    const runningExecutionId = randomUUID();
    await prisma.agentExecution.create({
      data: { id: runningExecutionId, missionId: fx.missionId, generationJobId: fx.jobId, agentKey: 'backend.nestjs.developer', agentInstanceId: instance.id, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, mode: 'COGNITIVE', attempt: 1, reason: 'INITIAL', status: 'RUNNING', startedAt: new Date() },
    });

    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('RUNNING');
    expect((outcome as { idempotentReplay: boolean }).idempotentReplay).toBe(true);
    expect(outcome.agentExecutionId).toBe(runningExecutionId);

    const totalExecutions = await prisma.agentExecution.count({ where: { missionId: fx.missionId } });
    expect(totalExecutions).toBe(1); // nunca duplicou.
  });

  // Q/R. version freeze permanece / currentVersion mudar não afeta execução.
  it('Q/R: version freeze survives a later currentVersion bump', async () => {
    const key = `test-core5.version-freeze.${randomUUID()}`;
    const unitKey = `unit.test-core5.${key}`;
    await catalog.upsertUnit({ key: unitKey, departmentKey: 'dept.web', name: 'Test Unit', engineeringType: 'test' });
    await catalog.ensureDefinition({ key, unitKey });
    await catalog.createVersion(key, 1, {
      identity: { role: 'Test Dev', seniority: 'MID' }, roleMission: 'v1', capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer', promptTemplateVersion: 'v1', outputSchemaKey: 'ChangeSetProposalV1', boundaries: ['no-op'], cognitiveMode: 'COGNITIVE',
    });
    await catalog.publishVersion(key, 1);

    const fx = await createFixture();
    await prisma.generationJob.update({ where: { id: fx.jobId }, data: { agentKey: key } });
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: key });
    expect(instance.agentDefinitionVersion).toBe(1);

    await catalog.createVersion(key, 2, {
      identity: { role: 'Test Dev', seniority: 'SENIOR' }, roleMission: 'v2', capabilityKeys: ['language.typescript'],
      promptTemplateKey: 'nestjs.developer', promptTemplateVersion: 'v1', outputSchemaKey: 'ChangeSetProposalV1', boundaries: ['no-op'], cognitiveMode: 'COGNITIVE',
    });
    await catalog.publishVersion(key, 2);

    const instanceAgain = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: key });
    expect(instanceAgain.agentDefinitionVersion).toBe(1); // nunca re-congela.

    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('SUCCEEDED');
    const execution = await prisma.agentExecution.findUnique({ where: { id: outcome.agentExecutionId } });
    expect(execution!.agentDefinitionVersion).toBe(1);

    const testDefinition = await prisma.agentDefinition.findUnique({ where: { key } });
    if (testDefinition) await prisma.agentDefVersion.deleteMany({ where: { agentDefinitionId: testDefinition.id } });
    await prisma.agentDefinition.deleteMany({ where: { key } });
    await prisma.unitDefinition.deleteMany({ where: { key: unitKey } });
  });

  // S. provider failure → FAILED.
  it('S: a provider failure fails the execution with LLM_INVOCATION_FAILED', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push('FAIL');
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('FAILED');
    expect((outcome as { errorCode: string }).errorCode).toBe('LLM_INVOCATION_FAILED');
    const execution = await prisma.agentExecution.findUnique({ where: { id: outcome.agentExecutionId } });
    expect(execution!.status).toBe('FAILED');
  });

  // T. structured output failure → FAILED apropriado.
  it('T: structured output repair exhaustion fails with STRUCTURED_OUTPUT_REPAIR_EXHAUSTED', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push('INVALID_JSON');
    llm.push('INVALID_JSON');
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('FAILED');
    expect((outcome as { errorCode: string }).errorCode).toBe('STRUCTURED_OUTPUT_REPAIR_EXHAUSTED');
  });

  // U. CONTEXT_OVERFLOW → FAILED com código original.
  it('U: an oversized incompressible context fails with the original CONTEXT_OVERFLOW code', async () => {
    const fx = await createFixture({ requirementContent: 'X'.repeat(40000) });
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('FAILED');
    expect((outcome as { errorCode: string }).errorCode).toBe('CONTEXT_OVERFLOW');
  });

  // V. self-check repair: SELF_CHECKING → IMPLEMENTING → SELF_CHECKING.
  it('V: a NEEDS_REPAIR self-check drives SELF_CHECKING -> IMPLEMENTING -> SELF_CHECKING', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'NEEDS_REPAIR')));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts', { confidence: 0.95 })));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'READY')));

    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('SUCCEEDED');

    const timeline = await runtime.getTimeline(outcome.agentExecutionId);
    const transitions = timeline.filter((e) => e.toState !== null).map((e) => `${e.fromState}->${e.toState}`);
    expect(transitions).toContain('SELF_CHECKING->IMPLEMENTING');
    expect(transitions.filter((t) => t === 'IMPLEMENTING->SELF_CHECKING').length).toBe(2);
  });

  // W. self-check exhausted → FAILED.
  it('W: self-check still NEEDS_REPAIR after the one allowed pass fails with SELF_CHECK_REPAIR_EXHAUSTED', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'NEEDS_REPAIR')));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'NEEDS_REPAIR')));

    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('FAILED');
    expect((outcome as { errorCode: string }).errorCode).toBe('SELF_CHECK_REPAIR_EXHAUSTED');
  });

  // X. cancel antes de analysis funciona.
  it('X: cancelling before ANALYZING stops the execution before any analysis LLM call', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);

    const outcome = await runtime.summon(
      { missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id },
      {
        onBeforePhase: async ({ executionId, to }) => {
          if (to === 'ANALYZING') await runtime.cancel(executionId, 'cancel before analysis');
        },
      }
    );
    expect(outcome.status).toBe('CANCELLED');
    expect(llm.calls.length).toBe(0); // nenhuma chamada LLM chegou a acontecer.
    const execution = await prisma.agentExecution.findUnique({ where: { id: outcome.agentExecutionId } });
    expect(execution!.status).toBe('CANCELLED');
  });

  // Y. cancel entre phases impede próxima phase.
  it('Y: cancelling between phases prevents the next phase from starting', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);

    const outcome = await runtime.summon(
      { missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id },
      {
        onBeforePhase: async ({ executionId, to }) => {
          if (to === 'PLANNING') await runtime.cancel(executionId, 'cancel between analysis and planning');
        },
      }
    );
    expect(outcome.status).toBe('CANCELLED');
    expect(llm.calls.length).toBe(1); // ANALYSIS já tinha rodado; PLANNING nunca começou.
  });

  // Z. timeout → FAILED.
  it('Z: an already-expired execution deadline fails with AGENT_EXECUTION_TIMEOUT', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id, executionDeadlineMs: -1000 });
    expect(outcome.status).toBe('FAILED');
    expect((outcome as { errorCode: string }).errorCode).toBe('AGENT_EXECUTION_TIMEOUT');
    expect(llm.calls.length).toBe(0);
  });

  // AA. stale detection funciona.
  it('AA: detectStaleExecutions finds RUNNING executions with an old heartbeat, markStaleAsFailed fails them', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    const staleId = randomUUID();
    await prisma.agentExecution.create({
      data: {
        id: staleId, missionId: fx.missionId, generationJobId: fx.jobId, agentKey: 'backend.nestjs.developer', agentInstanceId: instance.id,
        agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, mode: 'COGNITIVE', attempt: 1, reason: 'INITIAL',
        status: 'RUNNING', startedAt: new Date(Date.now() - 3_600_000), heartbeatAt: new Date(Date.now() - 3_600_000),
      },
    });

    const stale = await runtime.detectStaleExecutions(60_000);
    expect(stale.some((e) => e.id === staleId)).toBe(true);

    const failedCount = await runtime.markStaleAsFailed(60_000);
    expect(failedCount).toBeGreaterThanOrEqual(1);
    const row = await prisma.agentExecution.findUnique({ where: { id: staleId } });
    expect(row!.status).toBe('FAILED');
    expect(row!.errorCode).toBe('AGENT_EXECUTION_STALE');
  });

  it('AA2: detectStaleExecutions never auto-fails (only markStaleAsFailed does)', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    const id = randomUUID();
    await prisma.agentExecution.create({
      data: { id, missionId: fx.missionId, generationJobId: fx.jobId, agentKey: 'backend.nestjs.developer', agentInstanceId: instance.id, agentDefinitionKey: 'backend.nestjs.developer', agentDefinitionVersion: 1, mode: 'COGNITIVE', attempt: 1, reason: 'INITIAL', status: 'RUNNING', startedAt: new Date(Date.now() - 3_600_000), heartbeatAt: new Date(Date.now() - 3_600_000) },
    });
    await runtime.detectStaleExecutions(60_000);
    const row = await prisma.agentExecution.findUnique({ where: { id } });
    expect(row!.status).toBe('RUNNING'); // detectStaleExecutions sozinho nunca muda estado.
  });

  // AB. metrics são derivadas do ledger.
  it('AB: getMetrics is derived from LlmInvocationRecord, not a separate counter', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });

    const invocations = await prisma.llmInvocationRecord.findMany({ where: { agentExecutionId: outcome.agentExecutionId } });
    const metrics = await runtime.getMetrics(outcome.agentExecutionId);
    expect(metrics.llmCalls).toBe(invocations.length);
    expect(metrics.tokensIn).toBe(invocations.reduce((s, i) => s + (i.inputTokens ?? 0), 0));
    expect(metrics.tokensOut).toBe(invocations.reduce((s, i) => s + (i.outputTokens ?? 0), 0));
  });

  // AC. nenhuma credential em timeline/error.
  it('AC: no credential-shaped value ever appears in timeline events or execution rows', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    const timeline = await runtime.getTimeline(outcome.agentExecutionId);
    const execution = await prisma.agentExecution.findUnique({ where: { id: outcome.agentExecutionId } });
    const text = JSON.stringify({ timeline, execution }).toLowerCase();
    for (const term of ['apikey', 'api_key', 'secret', 'credential', 'password']) expect(text).not.toContain(term);
  });

  // AD. nenhuma CoT em timeline.
  it('AD: timeline metadata only contains structured facts (state names, error codes, confidence), never free text', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    const timeline = await runtime.getTimeline(outcome.agentExecutionId);
    for (const event of timeline) {
      const metadata = event.metadataJson as Record<string, unknown>;
      const keys = Object.keys(metadata);
      for (const key of keys) expect(['confidenceScore', 'errorCode', 'reason']).toContain(key);
    }
  });

  // AE. COMPLETED cognitivo não promove artifact.
  it('AE: a COMPLETED execution never mutates GeneratedArtifact rows directly', async () => {
    const fx = await createFixture();
    const before = await prisma.generatedArtifact.findMany({ where: { missionId: fx.missionId } });
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    const after = await prisma.generatedArtifact.findMany({ where: { missionId: fx.missionId } });
    expect(after).toEqual(before);
  });

  // AF. COMPLETED cognitivo não marca projeto entregue.
  it('AF: AgentRuntimeService never touches MissionGenerationRun (delivery status untouched)', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    const run = await prisma.missionGenerationRun.findUnique({ where: { missionId: fx.missionId } });
    expect(run).toBeNull(); // AgentRuntime nunca cria/altera MissionGenerationRun.
  });
});

(RUN_DB_TESTS ? describe : describe.skip)('CORE-005 production path integration (GenerationEngineService.attemptStructuredJob)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let ledger: LlmInvocationLedgerService;
  let llm: FakeLlmClient;
  let runtime: AgentRuntimeService;
  let service: GenerationEngineService;
  const missionIdsToClean: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
    ledger = new LlmInvocationLedgerService(prisma);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    const agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
    const eventBus = new EventBusService();
    const eventLog = new EventLogService(prisma, eventBus);
    runtime = new AgentRuntimeService(prisma, catalog, contextLoader, agentExecution, eventLog);
    const jobScope = new JobScopeService(prisma);
    // §AG: attemptStructuredJob só usa prisma/catalog/agentRuntime/eventLog/jobScope — as demais
    // 7 dependências do construtor nunca são tocadas por esse método, ficam como stubs inertes.
    service = new GenerationEngineService(
      prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, catalog, runtime, eventLog, jobScope,
      { inspectValidateAndRecord: async () => ({ inspections: [], result: { status: 'PASS', findings: [] }, evidence: { changeSetHash: 'test-change', inspectionHash: 'test-inspection', repositoryFingerprint: 'test-repository' } }) } as never,
      { validate: async () => ({ status: 'VALIDATED', errorCode: null }) } as never
    );
  });

  afterAll(async () => {
    for (const missionId of missionIdsToClean) await cleanupMission(missionId);
    await prisma.$disconnect();
  });

  async function cleanupMission(missionId: string): Promise<void> {
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

  async function createFixture(): Promise<Fixture> {
    const missionId = `test-core5-prod-${randomUUID()}`;
    missionIdsToClean.push(missionId);
    await prisma.discoveryConversation.create({ data: { missionId, status: 'HANDED_OFF', rawUserIdea: 'Demo API', domain: 'api', goal: 'goal' } });
    await prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: `sol-${missionId}`, architectureCompositionId: `comp-${missionId}`, status: 'APPROVED' } });
    const requirementId = randomUUID();
    await prisma.requirement.create({
      data: { id: requirementId, missionId, section: 'businessRules', content: 'GET /health.', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', updatedAt: new Date() },
    });
    const jobId = randomUUID();
    return { missionId, requirementId, jobId };
  }

  // AG. ao menos 1 call path real de GenerationEngine usa AgentRuntime estruturado.
  it('AG: attemptStructuredJob (real GenerationEngineService method) drives a real AgentRuntime execution to COMPLETED with materializable content', async () => {
    const fx = await createFixture();
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'READY')));

    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await (service as unknown as { attemptStructuredJob: (job: typeof plannedJob, missionId: string, run: { id: string }) => Promise<{ ok: boolean; agentExecutionId?: string; updatedFileContent?: string }> }).attemptStructuredJob(plannedJob, fx.missionId, { id: `run-${fx.missionId}` });

    expect(result.ok).toBe(true);
    expect(result.updatedFileContent).toBe('// handler content');
    expect(result.agentExecutionId).toBeDefined();

    const execution = await prisma.agentExecution.findUnique({ where: { id: result.agentExecutionId! } });
    expect(execution!.status).toBe('SUCCEEDED');
  });

  // AH. fallback legado, se mantido, é explícito e auditável.
  it('AH: an agentKey absent from the catalog produces an explicit, audited fallback reason', async () => {
    const fx = await createFixture();
    const plannedJob = { requirementId: fx.requirementId, requirementText: 'x', targetResource: 'X', targetFile: 'src/x/x.controller.ts', agentKey: 'stack.does-not-exist.developer' };
    const result = await (service as unknown as { attemptStructuredJob: (job: typeof plannedJob, missionId: string, run: { id: string }) => Promise<{ ok: boolean; fallbackReason?: string }> }).attemptStructuredJob(plannedJob, fx.missionId, { id: `run-${fx.missionId}` });
    // attemptStructuredJob não checa elegibilidade sozinho (isso é feito no loop de runPipeline
    // antes de chamá-lo) — chamado direto com um Job cujo requirementId não bate um AgentInstance
    // resolvível, o próprio summon() rejeita e o resultado carrega o motivo explícito.
    expect(result.ok).toBe(false);
    expect(result.fallbackReason).toBeDefined();
    expect(typeof result.fallbackReason).toBe('string');
  });

  it('AH2: ChangeSetProposal without usable content for the target file falls back with CHANGESET_CONTENT_MISSING', async () => {
    const fx = await createFixture();
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn({ changes: [{ operation: 'MODIFY', path: 'src/health/health.controller.ts', diff: '- old\n+ new', rationale: 'sem content, só diff' }], requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: 'nota' }], confidence: 0.8 }));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'READY')));

    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await (service as unknown as { attemptStructuredJob: (job: typeof plannedJob, missionId: string, run: { id: string }) => Promise<{ ok: boolean; fallbackReason?: string }> }).attemptStructuredJob(plannedJob, fx.missionId, { id: `run-${fx.missionId}` });
    expect(result.ok).toBe(false);
    expect(result.fallbackReason).toBe('CHANGESET_CONTENT_MISSING');
  });
});
