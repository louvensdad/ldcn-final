import { randomUUID } from 'node:crypto';
import { firstValueFrom, Subject } from 'rxjs';
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
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { EventsController } from '../events/events.controller';
import { LiveEventEnvelope } from '../events/live-event-envelope';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeLlmClient implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queued: (LlmCompletionResult | 'FAIL')[] = [];
  push(item: LlmCompletionResult | 'FAIL'): void { this.queued.push(item); }
  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queued.shift();
    if (!next) throw new Error('FakeLlmClient: no queued response');
    if (next === 'FAIL') throw new Error('simulated provider failure');
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
function changeSetFixture(requirementId: string, targetFile: string): Record<string, unknown> {
  return { changes: [{ operation: 'MODIFY', path: targetFile, content: '// handler', rationale: 'add GET /health' }], requirementCoverageSummary: [{ requirementId, implementationNote: 'done' }], confidence: 0.8 };
}
function selfCheckFixture(requirementId: string, verdict: 'READY' | 'NEEDS_REPAIR'): Record<string, unknown> {
  return { verdict, findings: [], requirementCheck: [{ requirementId, status: verdict === 'READY' ? 'SATISFIED' : 'PARTIAL', evidenceSummary: 'ok' }], confidence: verdict === 'READY' ? 0.9 : 0.5 };
}

interface Fixture { missionId: string; requirementId: string; jobId: string }

(RUN_DB_TESTS ? describe : describe.skip)('CORE-006 Live Event Backbone (Postgres, fake LlmClient)', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let ledger: LlmInvocationLedgerService;
  let eventBus: EventBusService;
  let eventLog: EventLogService;
  let llm: FakeLlmClient;
  let runtime: AgentRuntimeService;
  const missionIdsToClean: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
  });

  beforeEach(() => {
    llm = new FakeLlmClient();
    eventBus = new EventBusService();
    eventLog = new EventLogService(prisma, eventBus);
    ledger = new LlmInvocationLedgerService(prisma, eventLog);
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    const agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
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

  async function createFixture(): Promise<Fixture> {
    const missionId = `test-core6-${randomUUID()}`;
    missionIdsToClean.push(missionId);
    await prisma.discoveryConversation.create({ data: { missionId, status: 'HANDED_OFF', rawUserIdea: 'Demo API', domain: 'api', goal: 'goal' } });
    await prisma.architectureReview.create({ data: { id: randomUUID(), missionId, approvedSolutionId: `sol-${missionId}`, architectureCompositionId: `comp-${missionId}`, status: 'APPROVED' } });
    const requirementId = randomUUID();
    await prisma.requirement.create({
      data: { id: requirementId, missionId, section: 'functional', content: 'GET /health.', origin: 'AI_SUGGESTED', status: 'CONFIRMED', createdBy: 'test', updatedAt: new Date() },
    });
    const jobId = randomUUID();
    await prisma.generationJob.create({
      data: { id: jobId, missionId, generationRunId: `run-${missionId}`, requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer', status: 'PENDING' },
    });
    await prisma.generatedArtifact.create({
      data: { id: randomUUID(), missionId, generationRunId: `run-${missionId}`, path: 'src/health/health.controller.ts', target: 'backend', pluginId: 'nestjs', ownerAgent: 'backend.nestjs.developer', version: 1, hash: 'h', sizeBytes: 10, symbolsJson: [], importsJson: [], exportsJson: [], provenance: `requirement:${requirementId}` },
    });
    return { missionId, requirementId, jobId };
  }

  function queueHappyPath(fx: Fixture): void {
    llm.push(turn(analysisFixture()));
    llm.push(turn(planFixture()));
    llm.push(turn(changeSetFixture(fx.requirementId, 'src/health/health.controller.ts')));
    llm.push(turn(selfCheckFixture(fx.requirementId, 'READY')));
  }

  async function runHappyPath(fx: Fixture) {
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    return runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
  }

  // A. EventLog é append-only.
  it('A: EventLogService only exposes append/appendWithinTransaction/publish/list/read-model — no update/delete', () => {
    const proto = Object.getPrototypeOf(eventLog) as Record<string, unknown>;
    const methodNames = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    for (const name of methodNames) expect(name).not.toMatch(/update|delete|remove/i);
  });

  it('A2: two appends for the same Mission always produce two distinct EventLog rows (never overwritten)', async () => {
    const fx = await createFixture();
    const e1 = await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });
    const e2 = await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });
    expect(e1.id).not.toBe(e2.id);
    const rows = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    expect(rows).toHaveLength(2);
  });

  // B/C. event possui missionId e sequence.
  it('B/C: an appended event carries missionId and a numeric sequence', async () => {
    const fx = await createFixture();
    const event = await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });
    expect(event.missionId).toBe(fx.missionId);
    expect(typeof event.sequence).toBe('number');
    expect(event.sequence).toBeGreaterThan(0);
  });

  // D. ordem por sequence correta.
  it('D: sequential appends for the same Mission get strictly increasing sequence numbers', async () => {
    const fx = await createFixture();
    const events: LiveEventEnvelope[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: { i } }));
    }
    const sequences = events.map((e) => e.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(5);
  });

  // E/F. AgentRuntime transition cria EventLog / timeline+state+EventLog consistentes.
  it('E/F: every FSM transition creates a matching EventLog row, consistent with the timeline', async () => {
    const fx = await createFixture();
    const outcome = await runHappyPath(fx);
    expect(outcome.status).toBe('SUCCEEDED');

    const timeline = await runtime.getTimeline(outcome.agentExecutionId);
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } });

    const timelineTransitions = timeline.filter((t) => t.toState !== null);
    for (const transition of timelineTransitions) {
      const matching = events.find((e) => e.payloadJson && (e.payloadJson as Record<string, unknown>).toState === transition.toState && (e.payloadJson as Record<string, unknown>).fromState === transition.fromState);
      expect(matching).toBeDefined();
    }
  });

  // G-K. cada fase gera evento real.
  it('G-K: ANALYSIS/PLANNING/IMPLEMENTATION/SELF_CHECK/COMPLETED each produce a real, correctly-typed event', async () => {
    const fx = await createFixture();
    const outcome = await runHappyPath(fx);
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    const types = events.map((e) => e.type);
    expect(types).toContain('agent.analysis_completed');
    expect(types).toContain('agent.planning_completed');
    expect(types).toContain('agent.implementation_completed');
    expect(types).toContain('agent.selfcheck_completed');
    expect(types).toContain('agent.completed');
    expect(outcome.status).toBe('SUCCEEDED');
  });

  // L. FAILED gera evento real.
  it('L: a failed execution produces an agent.failed event', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push('FAIL');
    const outcome = await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    expect(outcome.status).toBe('FAILED');
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    expect(events.map((e) => e.type)).toContain('agent.failed');
  });

  // M. CANCELLED gera evento real.
  it('M: a cancelled execution produces an agent.cancelled event', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    queueHappyPath(fx);
    const outcome = await runtime.summon(
      { missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id },
      { onBeforePhase: async ({ executionId, to }) => { if (to === 'ANALYZING') await runtime.cancel(executionId, 'test cancel'); } }
    );
    expect(outcome.status).toBe('CANCELLED');
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    expect(events.map((e) => e.type)).toContain('agent.cancelled');
  });

  // N/O/P. LLM start/success/failure criam evento.
  it('N/O: a successful LLM invocation produces agent.llm_invocation_started and agent.llm_invocation_completed', async () => {
    const fx = await createFixture();
    await runHappyPath(fx);
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === 'agent.llm_invocation_started').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'agent.llm_invocation_completed').length).toBeGreaterThanOrEqual(4);
  });

  it('P: a failed LLM invocation produces agent.llm_invocation_failed', async () => {
    const fx = await createFixture();
    const instance = await runtime.ensureInstance({ missionId: fx.missionId, agentDefinitionKey: 'backend.nestjs.developer' });
    llm.push('FAIL');
    await runtime.summon({ missionId: fx.missionId, jobId: fx.jobId, agentInstanceId: instance.id });
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    expect(events.map((e) => e.type)).toContain('agent.llm_invocation_failed');
  });

  // Q/R/S. nenhuma credential/prompt bruto/CoT no payload.
  it('Q/R/S: no event payload ever contains a credential, raw prompt, or chain-of-thought', async () => {
    const fx = await createFixture();
    await runHappyPath(fx);
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId } });
    const text = JSON.stringify(events).toLowerCase();
    for (const term of ['apikey', 'api_key', 'secret', 'credential', 'password']) expect(text).not.toContain(term);
    // nenhum payload carrega o prompt renderizado completo (system/user) nem CoT — só ids/hashes/refs/summaries curtos.
    for (const event of events) {
      const payload = event.payloadJson as Record<string, unknown>;
      expect(payload).not.toHaveProperty('systemText');
      expect(payload).not.toHaveProperty('userText');
      expect(payload).not.toHaveProperty('renderedText');
      expect(payload).not.toHaveProperty('chainOfThought');
    }
  });

  it('S2: append() actively rejects a payload containing a credential-shaped term', async () => {
    const fx = await createFixture();
    await expect(
      eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: { apiKey: 'sk-should-not-be-here' } })
    ).rejects.toThrow('EVENT_LOG_CREDENTIAL_NOT_ALLOWED');
  });

  // T. Mission A não vê eventos de B.
  it('T: Mission A never sees Mission B events, in replay or live subscription', async () => {
    const fxA = await createFixture();
    const fxB = await createFixture();
    await eventLog.append({ missionId: fxA.missionId, correlationId: fxA.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });
    await eventLog.append({ missionId: fxB.missionId, correlationId: fxB.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });

    const replayA = await eventLog.listMissionEvents({ missionId: fxA.missionId });
    expect(replayA.every((e) => e.missionId === fxA.missionId)).toBe(true);
    expect(replayA.some((e) => e.missionId === fxB.missionId)).toBe(false);

    const received: LiveEventEnvelope[] = [];
    const sub = eventBus.envelopeStreamForMission(fxA.missionId).subscribe((e) => received.push(e));
    await eventLog.append({ missionId: fxB.missionId, correlationId: fxB.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: {} });
    await eventLog.append({ missionId: fxA.missionId, correlationId: fxA.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: {} });
    // REWORK 01: entrega live agora é desacoplada do stack do produtor (setTimeout(0) por
    // subscriber) — espera um tick real antes de checar o que chegou.
    await new Promise((resolve) => setTimeout(resolve, 50));
    sub.unsubscribe();
    expect(received.every((e) => e.missionId === fxA.missionId)).toBe(true);
    expect(received.length).toBe(1);
  });

  // U/V. replay afterSequence funciona / mantém ordem.
  it('U/V: replay with afterSequence returns only newer events, in sequence order', async () => {
    const fx = await createFixture();
    const all: LiveEventEnvelope[] = [];
    for (let i = 0; i < 6; i++) all.push(await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: { i } }));

    const after3 = await eventLog.listMissionEvents({ missionId: fx.missionId, afterSequence: all[2].sequence });
    expect(after3.map((e) => e.sequence)).toEqual(all.slice(3).map((e) => e.sequence));
    expect(after3.map((e) => e.sequence)).toEqual([...after3.map((e) => e.sequence)].sort((a, b) => a - b));
  });

  // W. live subscription recebe evento novo.
  it('W: a live subscription receives a newly appended event', async () => {
    const fx = await createFixture();
    const received = firstValueFrom(eventBus.envelopeStreamForMission(fx.missionId));
    const published = await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: {} });
    const event = await received;
    expect(event.id).toBe(published.id);
  });

  // X. reconnect não duplica evento já recebido — testado direto no EventsController.stream().
  it('X: reconnecting with afterSequence never re-delivers already-seen events, and never duplicates events published mid-replay', async () => {
    const fx = await createFixture();
    const first5: LiveEventEnvelope[] = [];
    for (let i = 0; i < 5; i++) first5.push(await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: { i } }));

    const controller = new EventsController(eventBus, eventLog);
    const received: LiveEventEnvelope[] = [];
    const observable = controller.stream(fx.missionId, String(first5[4].sequence));
    const sub = observable.subscribe((msg) => received.push(msg.data as LiveEventEnvelope));

    // Eventos 6..10 acontecem DEPOIS da reconexão.
    const next5: LiveEventEnvelope[] = [];
    for (let i = 5; i < 10; i++) next5.push(await eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_progress', payload: { i } }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    sub.unsubscribe();

    const receivedSequences = received.map((e) => e.sequence);
    expect(receivedSequences).not.toEqual(expect.arrayContaining(first5.map((e) => e.sequence)));
    expect(receivedSequences.sort((a, b) => a - b)).toEqual(next5.map((e) => e.sequence).sort((a, b) => a - b));
    expect(new Set(receivedSequences).size).toBe(receivedSequences.length); // nunca duplicado.
  });

  // Y. fallback legacy emite reason.
  it('Y: GenerationEngineService.emitJobOutcomeEvents records an explicit, audited reason for a legacy fallback', async () => {
    const fx = await createFixture();
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    const agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
    const jobScope = new JobScopeService(prisma);
    const service = new GenerationEngineService(prisma, {} as never, {} as never, {} as never, agentExecution, {} as never, {} as never, {} as never, eventBus, catalog, runtime, eventLog, jobScope, {} as never, {} as never);

    await (service as unknown as { emitJobOutcomeEvents: (i: unknown) => Promise<void> }).emitJobOutcomeEvents({
      missionId: fx.missionId, jobId: fx.jobId, agentKey: 'stack.does-not-exist.developer', targetFile: 'src/x.ts',
      executionMode: 'LEGACY_COMPATIBILITY', fallbackReason: 'AGENT_NOT_IN_CATALOG', agentExecutionId: null,
      finalStatus: 'IMPLEMENTED', finalErrorCode: null, completedJobCount: 1, totalJobs: 1,
    });

    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId, type: 'job.execution_mode_selected' } });
    expect(events).toHaveLength(1);
    const payload = events[0].payloadJson as Record<string, unknown>;
    expect(payload.mode).toBe('LEGACY_COMPATIBILITY');
    expect(payload.reason).toBe('AGENT_NOT_IN_CATALOG');
  });

  // Z. structured production path emite eventos.
  it('Z: the real GenerationEngineService.attemptStructuredJob production method drives real EventLog emission', async () => {
    const fx = await createFixture();
    queueHappyPath(fx);
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    const agentExecution = new AgentExecutionService(llm, prisma, ledger, catalog, promptMaster);
    const jobScope = new JobScopeService(prisma);
    const service = new GenerationEngineService(
      prisma, {} as never, {} as never, {} as never, agentExecution, {} as never, {} as never, {} as never, eventBus, catalog, runtime, eventLog, jobScope,
      { inspectValidateAndRecord: async () => ({ inspections: [], result: { status: 'PASS', findings: [] }, evidence: { changeSetHash: 'test-change', inspectionHash: 'test-inspection', repositoryFingerprint: 'test-repository' } }) } as never,
      { validate: async () => ({ status: 'VALIDATED', errorCode: null }) } as never
    );

    const plannedJob = { requirementId: fx.requirementId, requirementText: 'GET /health.', targetResource: 'Health', targetFile: 'src/health/health.controller.ts', agentKey: 'backend.nestjs.developer' };
    const result = await (service as unknown as { attemptStructuredJob: (j: typeof plannedJob, m: string, r: { id: string }) => Promise<{ ok: boolean; agentExecutionId?: string }> }).attemptStructuredJob(plannedJob, fx.missionId, { id: `run-${fx.missionId}` });

    expect(result.ok).toBe(true);
    const events = await prisma.eventLog.findMany({ where: { correlationId: result.agentExecutionId } });
    expect(events.length).toBeGreaterThan(0);
    expect(events.map((e) => e.type)).toContain('agent.completed');
  });

  // AA. consumer lento não bloqueia runtime.
  it('AA: a slow subscriber never blocks the FSM runtime from completing', async () => {
    const fx = await createFixture();
    const slowSubject = new Subject<LiveEventEnvelope>();
    let slowCount = 0;
    eventBus.envelopeStreamForMission(fx.missionId).subscribe(() => {
      slowCount++;
      // Assinante "lento": nunca retorna uma Promise, nunca é aguardado — Subject.next() é
      // síncrono e nunca espera o subscriber terminar de processar.
      const start = Date.now();
      while (Date.now() - start < 5) { /* busy-wait curto simulando trabalho de UI */ }
    });
    const startedAt = Date.now();
    const outcome = await runHappyPath(fx);
    const elapsedMs = Date.now() - startedAt;
    expect(outcome.status).toBe('SUCCEEDED');
    expect(slowCount).toBeGreaterThan(0);
    // Não é uma prova de non-blocking assíncrono real (Node é single-threaded), mas prova que o
    // runtime nunca faz `await` na entrega ao subscriber — o subscriber lento roda inline e a
    // execução ainda termina em tempo hábil de teste, sem timeout.
    expect(elapsedMs).toBeLessThan(10_000);
    slowSubject.complete();
  });

  // AB. event persist failure não publica fato fantasma.
  it('AB: a rejected append() (credential in payload) never publishes and never persists a phantom fact', async () => {
    const fx = await createFixture();
    const received: LiveEventEnvelope[] = [];
    const sub = eventBus.envelopeStreamForMission(fx.missionId).subscribe((e) => received.push(e));

    await expect(
      eventLog.append({ missionId: fx.missionId, correlationId: fx.missionId, actorType: 'TEST', type: 'mission.generation_started', payload: { secret: 'x' } })
    ).rejects.toThrow();

    sub.unsubscribe();
    expect(received).toHaveLength(0);
    const rows = await prisma.eventLog.count({ where: { missionId: fx.missionId } });
    expect(rows).toBe(0);
  });
});
