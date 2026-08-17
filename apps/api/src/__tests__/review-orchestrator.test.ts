import { createHash, randomUUID } from 'node:crypto';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';
import { AgentExecutionService } from '../generation-engine/agent-execution.service';
import { CandidateBuildRunner } from '../generation-engine/candidate-build-runner';
import { CandidateTestRunner } from '../generation-engine/candidate-test-runner';
import { ReviewOrchestrator } from '../generation-engine/review-orchestrator.service';
import { WorkspaceSessionService } from '../generation-engine/workspace-session.service';
import { WorkspaceValidationService } from '../generation-engine/workspace-validation.service';
import { WorkspaceService } from '../generation-engine/workspace.service';
import { DuplicateValidationService } from '../generation-engine/duplicate-validation.service';
import { RepositoryInspector } from '../generation-engine/repository-inspector';
import { JobScopeService } from '../generation-engine/job-scope.service';
import { GenerationEngineService } from '../generation-engine/generation-engine.service';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { PrismaService } from '../persistence/prisma.service';
import { ContextLoaderService } from '../promptmaster/context-loader.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakeLlm implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  queue: (LlmCompletionResult | Error)[] = [];
  async complete(input: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(input);
    const next = this.queue.shift();
    if (!next) throw new Error('FAKE_RESPONSE_MISSING');
    if (next instanceof Error) throw next;
    return next;
  }
}

class PassingRunner {
  calls: string[] = [];
  async runCommandNoShell(_command: string, _args: string[], cwd: string) {
    this.calls.push(cwd);
    const isTest = this.calls.length % 3 === 0;
    return { command: 'fixture', exitCode: 0, durationMs: 1, logsExcerpt: isTest ? '# tests 1\n# pass 1\n# fail 0\n# skipped 0' : '', stdout: isTest ? '# tests 1\n# pass 1\n# fail 0\n# skipped 0' : '', stderr: '', timedOut: false };
  }
}

function response(body: unknown): LlmCompletionResult {
  return { text: typeof body === 'string' ? body : JSON.stringify(body), model: 'fake-reviewer', promptTokens: 20, completionTokens: 30 };
}

function reviewResult(requirementId: string, overrides: Record<string, unknown> = {}) {
  return { verdict: 'APPROVED', summary: 'Candidate implements uptimeSeconds correctly.', findings: [],
    requirementAssessment: [{ requirementId, status: 'SATISFIED', evidenceSummary: 'Validated source returns uptimeSeconds.' }], confidence: 0.91, ...overrides };
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-010 independent ReviewOrchestrator', () => {
  let prisma: PrismaService;
  let catalog: AgentCatalogService;
  let workspace: WorkspaceService;
  let fake: FakeLlm;
  let orchestrator: ReviewOrchestrator;
  let executions: AgentExecutionService;
  let runtime: AgentRuntimeService;
  let eventLog: EventLogService;
  const missions: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
  });

  beforeEach(() => {
    workspace = new WorkspaceService();
    fake = new FakeLlm();
    eventLog = new EventLogService(prisma, new EventBusService());
    const ledger = new LlmInvocationLedgerService(prisma, eventLog);
    const contextLoader = new ContextLoaderService(prisma);
    const promptMaster = new PromptMasterService(catalog, contextLoader, ledger, prisma);
    executions = new AgentExecutionService(fake, prisma, ledger, catalog, promptMaster);
    runtime = new AgentRuntimeService(prisma, catalog, contextLoader, executions, eventLog);
    orchestrator = new ReviewOrchestrator(prisma, catalog, runtime, executions, workspace, eventLog);
  });

  afterAll(async () => {
    for (const missionId of missions) {
      const roots = await prisma.workspaceSession.findMany({ where: { missionId }, select: { rootRef: true } });
      for (const root of roots) await workspace.discardSession(root.rootRef).catch(() => undefined);
      await prisma.codeReviewFinding.deleteMany({ where: { missionId } });
      await prisma.reviewRecord.deleteMany({ where: { missionId } });
      await prisma.testValidationRun.deleteMany({ where: { missionId } });
      await prisma.buildValidationRun.deleteMany({ where: { missionId } });
      await prisma.workspaceCandidateManifest.deleteMany({ where: { missionId } });
      await prisma.workspaceSession.deleteMany({ where: { missionId } });
      const executions = await prisma.agentExecution.findMany({ where: { missionId }, select: { id: true } });
      const ids = executions.map((row) => row.id);
      await prisma.agentCognitiveStep.deleteMany({ where: { agentExecutionId: { in: ids } } });
      await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
      await prisma.promptSnapshot.deleteMany({ where: { missionId } });
      await prisma.agentRuntimeTimelineEvent.deleteMany({ where: { missionId } });
      await prisma.agentExecution.deleteMany({ where: { missionId } });
      await prisma.agentInstance.deleteMany({ where: { missionId } });
      await prisma.eventLog.deleteMany({ where: { missionId } });
      await prisma.jobScopeValidation.deleteMany({ where: { missionId } });
      await prisma.duplicateValidation.deleteMany({ where: { missionId } });
      await prisma.jobScope.deleteMany({ where: { missionId } });
      await prisma.generatedArtifact.deleteMany({ where: { missionId } });
      await prisma.requirement.deleteMany({ where: { missionId } });
      await prisma.generationJob.deleteMany({ where: { missionId } });
    }
    await prisma.$disconnect();
  });

  async function fixture(executorKey = 'backend.nestjs.developer', candidateOverride?: string) {
    const missionId = `core10-${randomUUID()}`;
    const jobId = randomUUID();
    const requirementId = randomUUID();
    const path = 'src/health/health.controller.ts';
    const canonical = 'export const health = { status: "ok" };';
    const candidate = candidateOverride ?? 'export const health = { status: "ok", uptimeSeconds: process.uptime() };';
    missions.push(missionId);
    await workspace.writeFiles(missionId, [
      { path, content: canonical, provenance: 'scaffold', ownerAgent: 'fixture', symbols: [], imports: [], exports: [] },
      { path: 'package.json', content: JSON.stringify({ scripts: { build: 'node build.js' } }), provenance: 'scaffold', ownerAgent: 'fixture', symbols: [], imports: [], exports: [] },
      { path: 'build.js', content: '', provenance: 'scaffold', ownerAgent: 'fixture', symbols: [], imports: [], exports: [] },
    ]);
    await prisma.requirement.create({ data: { id: requirementId, missionId, section: 'businessRules', content: 'GET /health returns uptimeSeconds', origin: 'USER', status: 'CONFIRMED', createdBy: 'test' } });
    await prisma.generationJob.create({ data: { id: jobId, missionId, generationRunId: `run-${missionId}`, requirementId, requirementText: 'GET /health returns uptimeSeconds', targetResource: 'Health', targetFile: path, agentKey: executorKey, status: 'BUILD_TEST_VALIDATED' } });
    await prisma.jobScope.create({ data: { id: randomUUID(), missionId, generationJobId: jobId, allowedPathsJson: [path], scopeHash: 'scope-hash' } });
    await prisma.generatedArtifact.create({ data: { id: randomUUID(), missionId, generationRunId: `run-${missionId}`, path, target: 'BACKEND', pluginId: 'stack.typescript.nestjs', ownerAgent: 'fixture', hash: createHash('sha256').update(canonical).digest('hex'), sizeBytes: Buffer.byteLength(canonical), symbolsJson: [], importsJson: [], exportsJson: [], provenance: 'scaffold' } });
    const executorDef = await catalog.getVersion(executorKey, 1);
    const executorId = randomUUID();
    await prisma.agentExecution.create({ data: { id: executorId, missionId, generationJobId: jobId, agentKey: executorKey, agentDefinitionKey: executorKey, agentDefinitionVersion: executorDef ? 1 : null, mode: 'COGNITIVE', reason: 'INITIAL', status: 'SUCCEEDED', startedAt: new Date(), completedAt: new Date() } });
    const sessions = new WorkspaceSessionService(prisma, workspace);
    const runner = new PassingRunner();
    const validation = new WorkspaceValidationService(sessions, workspace, new CandidateBuildRunner(prisma, runner as never), new CandidateTestRunner(prisma, runner as never), new EventLogService(prisma, new EventBusService()));
    const validated = await validation.validate({ missionId, generationJobId: jobId, agentExecutionId: executorId, changeSetHash: 'change-hash', scopeHash: 'scope-hash', inspectionHash: 'inspection-hash', repositoryFingerprint: 'repository-fingerprint', changes: [{ operation: 'MODIFY', path, content: candidate, expectedBeforeHash: createHash('sha256').update(canonical).digest('hex') }] });
    if (validated.status !== 'VALIDATED') throw new Error(`FIXTURE_NOT_VALIDATED:${validated.status}`);
    return { missionId, jobId, requirementId, path, canonical, candidate, executorId, sessionId: validated.session.id };
  }

  it('A-C/F-L/R-V/AU/AW: reviews the exact validated isolated candidate with reviewer@v1 and safe evidence', async () => {
    const fx = await fixture();
    const reviewer = await catalog.getVersion('backend.nestjs.reviewer', 1);
    expect(reviewer?.canReview).toBe(true);
    fake.queue.push(response(reviewResult(fx.requirementId)));
    const outcome = await orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId });
    expect(outcome.verdict).toBe('APPROVED');
    expect(fake.calls[0].user).toContain(fx.candidate);
    expect(fake.calls[0].user).not.toContain(fx.canonical + '\n---');
    expect(fake.calls[0].user).toContain('buildEvidence');
    expect(fake.calls[0].user).toContain('testEvidence');
    const record = await prisma.reviewRecord.findUniqueOrThrow({ where: { id: outcome.reviewRecordId } });
    const execution = await prisma.agentExecution.findUniqueOrThrow({ where: { id: outcome.reviewerAgentExecutionId } });
    expect(execution.mode).toBe('COGNITIVE');
    expect(execution.agentDefinitionKey).toBe('backend.nestjs.reviewer');
    expect(execution.agentDefinitionVersion).toBe(1);
    expect(record.workspaceSessionId).toBe(fx.sessionId);
    expect(record.promptSnapshotId).toBeTruthy();
    expect(record.llmInvocationId).toBeTruthy();
    expect((await prisma.workspaceSession.findUniqueOrThrow({ where: { id: fx.sessionId } })).status).toBe('REVIEW_APPROVED');
    expect(await workspace.readWorkspaceFile(fx.missionId, fx.path)).toBe(fx.canonical);
    const events = await prisma.eventLog.findMany({ where: { missionId: fx.missionId, type: { startsWith: 'job.review_' } }, orderBy: { sequence: 'asc' } });
    expect(events.map((event) => event.type)).toEqual(['job.review_started', 'job.review_completed', 'job.review_approved']);
    expect(JSON.stringify(events)).not.toContain(fx.candidate);
  });

  it('D/E: rejects reviewer self-review before any LLM invocation', async () => {
    const fx = await fixture('backend.nestjs.reviewer');
    await expect(orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId })).rejects.toThrow('REVIEWER_CANNOT_REVIEW_OWN_WORK');
    expect(fake.calls).toHaveLength(0);
  });

  it('M/N: malformed output gets exactly one schema repair; exhaustion fails closed', async () => {
    const repaired = await fixture();
    fake.queue.push(response('not-json'), response(reviewResult(repaired.requirementId)));
    const approved = await orchestrator.startReview({ workspaceSessionId: repaired.sessionId, reviewCycle: 1, executorAgentExecutionId: repaired.executorId });
    expect(approved.verdict).toBe('APPROVED');
    const invocations = await prisma.llmInvocationRecord.findMany({ where: { agentExecutionId: approved.reviewerAgentExecutionId }, orderBy: { createdAt: 'asc' } });
    expect(invocations.map((row) => row.purpose)).toEqual(['REVIEW', 'REPAIR']);

    const exhausted = await fixture();
    fake.queue.push(response('bad'), response({ invalid: true }));
    await expect(orchestrator.startReview({ workspaceSessionId: exhausted.sessionId, reviewCycle: 1, executorAgentExecutionId: exhausted.executorId })).rejects.toThrow('STRUCTURED_OUTPUT_REPAIR_EXHAUSTED');
    expect((await prisma.agentExecution.findFirstOrThrow({ where: { missionId: exhausted.missionId, agentKey: 'backend.nestjs.reviewer' }, orderBy: { createdAt: 'desc' } })).status).toBe('FAILED');
  });

  it('O-T/AQ: deterministic policy overrides contradictory blockers and idempotency prevents a second call', async () => {
    const fx = await fixture();
    fake.queue.push(response(reviewResult(fx.requirementId, { verdict: 'APPROVED', findings: [{ id: randomUUID(), category: 'CORRECTNESS', severity: 'BLOCKER', path: fx.path, message: 'uptimeSeconds missing', requirementIds: [fx.requirementId] }] })));
    const [first, concurrent] = await Promise.all([
      orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId }),
      orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId }),
    ]);
    expect(first.verdict).toBe('REWORK_REQUIRED');
    expect(concurrent.reviewRecordId).toBe(first.reviewRecordId);
    const second = await orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId });
    expect(second.idempotentReplay).toBe(true);
    expect(second.resultHash).toBe(first.resultHash);
    expect(fake.calls).toHaveLength(1);
    expect(await prisma.codeReviewFinding.count({ where: { reviewRecordId: first.reviewRecordId } })).toBe(1);
  });

  it('Q/W-AB: UNSATISFIED triggers rework by the original exact executor in a new AgentExecution', async () => {
    const fx = await fixture();
    fake.queue.push(response(reviewResult(fx.requirementId, { requirementAssessment: [{ requirementId: fx.requirementId, status: 'UNSATISFIED', evidenceSummary: 'uptimeSeconds is absent' }] })));
    const rejected = await orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId });
    expect(rejected.verdict).toBe('REWORK_REQUIRED');
    fake.queue.push(response({ changes: [{ operation: 'MODIFY', path: fx.path, content: fx.candidate + '\n// fixed', rationale: 'Addresses review finding.' }], requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: 'Fixed uptimeSeconds.' }], confidence: 0.88 }));
    const rework = await orchestrator.executeRework({ reviewRecordId: rejected.reviewRecordId });
    expect(rework.agentExecutionId).not.toBe(fx.executorId);
    const execution = await prisma.agentExecution.findUniqueOrThrow({ where: { id: rework.agentExecutionId } });
    expect(execution.agentDefinitionKey).toBe('backend.nestjs.developer');
    expect(execution.agentDefinitionVersion).toBe(1);
    expect(execution.reason).toBe('REVIEW_REWORK');
    expect(execution.sourceWorkspaceSessionId).toBe(fx.sessionId);
    expect(fake.calls[1].user).toContain('uptimeSeconds is absent');
    expect((await prisma.workspaceSession.findUniqueOrThrow({ where: { id: fx.sessionId } })).status).toBe('VALIDATED');
  });

  it('AR: provider failure records FAILED cognitive evidence and never approves', async () => {
    const fx = await fixture();
    fake.queue.push(new Error('provider down'));
    await expect(orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId })).rejects.toThrow('LLM_INVOCATION_FAILED');
    const execution = await prisma.agentExecution.findFirstOrThrow({ where: { missionId: fx.missionId, agentKey: 'backend.nestjs.reviewer' } });
    expect(execution.status).toBe('FAILED');
    expect(await prisma.reviewRecord.count({ where: { missionId: fx.missionId, verdict: 'APPROVED' } })).toBe(0);
    expect(await prisma.reviewRecord.count({ where: { missionId: fx.missionId, verdict: 'REVIEW_EXECUTION_FAILED' } })).toBe(1);
  });

  it('W-AI/AV: production orchestration performs new executor execution, every guard, new workspace, build/test, then review again', async () => {
    const fx = await fixture();
    const firstFinding = { id: randomUUID(), category: 'REQUIREMENT', severity: 'HIGH', path: fx.path, message: 'uptimeSeconds was not implemented', requirementIds: [fx.requirementId] };
    fake.queue.push(
      response(reviewResult(fx.requirementId, { verdict: 'REWORK_REQUIRED', findings: [firstFinding], requirementAssessment: [{ requirementId: fx.requirementId, status: 'UNSATISFIED', evidenceSummary: 'Missing uptimeSeconds.' }] })),
      response({ changes: [{ operation: 'MODIFY', path: fx.path, content: fx.candidate + '\n// reviewed fix', rationale: 'Implements the rejected requirement.' }], requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: 'uptimeSeconds implemented.' }], confidence: 0.9 }),
      response(reviewResult(fx.requirementId))
    );
    const runner = new PassingRunner();
    const workspaceValidation = new WorkspaceValidationService(new WorkspaceSessionService(prisma, workspace), workspace, new CandidateBuildRunner(prisma, runner as never), new CandidateTestRunner(prisma, runner as never), eventLog);
    const jobScope = new JobScopeService(prisma);
    const duplicate = new DuplicateValidationService(prisma, new RepositoryInspector(prisma, workspace));
    const engine = new GenerationEngineService(prisma, {} as never, workspace, {} as never, executions, {} as never, {} as never, {} as never, new EventBusService(), catalog, runtime, eventLog, jobScope, duplicate, workspaceValidation, orchestrator);
    const outcome = await (engine as unknown as { runReviewAndExternalRework(input: { missionId: string; job: { requirementId: string; requirementText: string; targetResource: string; targetFile: string; agentKey: string }; generationJobId: string; workspaceSessionId: string; executorAgentExecutionId: string }): Promise<{ status: string; workspaceSessionId: string }> }).runReviewAndExternalRework({
      missionId: fx.missionId, generationJobId: fx.jobId, workspaceSessionId: fx.sessionId, executorAgentExecutionId: fx.executorId,
      job: { requirementId: fx.requirementId, requirementText: 'GET /health returns uptimeSeconds', targetResource: 'Health', targetFile: fx.path, agentKey: 'backend.nestjs.developer' },
    });
    expect(outcome.status).toBe('REVIEW_APPROVED');
    expect(outcome.workspaceSessionId).not.toBe(fx.sessionId);
    expect(await prisma.workspaceSession.count({ where: { missionId: fx.missionId } })).toBe(2);
    expect(await prisma.buildValidationRun.count({ where: { missionId: fx.missionId, status: 'PASS' } })).toBe(2);
    expect(await prisma.testValidationRun.count({ where: { missionId: fx.missionId, status: 'PASS' } })).toBe(2);
    expect(await prisma.jobScopeValidation.count({ where: { missionId: fx.missionId, status: 'PASS' } })).toBe(1);
    expect(await prisma.duplicateValidation.count({ where: { missionId: fx.missionId, status: 'PASS' } })).toBe(1);
    expect(await prisma.reviewRecord.count({ where: { missionId: fx.missionId } })).toBe(2);
    const reworkExecution = await prisma.agentExecution.findFirstOrThrow({ where: { missionId: fx.missionId, reason: 'REVIEW_REWORK' } });
    expect(reworkExecution.id).not.toBe(fx.executorId);
    expect(reworkExecution.agentDefinitionVersion).toBe(1);
    expect((await prisma.workspaceSession.findUniqueOrThrow({ where: { id: fx.sessionId } })).status).toBe('VALIDATED');
    expect(await workspace.readWorkspaceFile(fx.missionId, fx.path)).toBe(fx.canonical);
    const types = (await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } })).map((event) => event.type);
    expect(types.indexOf('job.review_rejected')).toBeLessThan(types.indexOf('job.rework_started'));
    expect(types.indexOf('job.rework_started')).toBeLessThan(types.indexOf('job.scope_validation_started'));
    expect(types.indexOf('job.workspace_validated', types.indexOf('job.rework_started'))).toBeLessThan(types.lastIndexOf('job.review_started'));
    expect(types).toContain('job.rework_completed');
  });

  it('AM-AO: stops after two external reworks and marks BLOCKED_NEEDS_HUMAN', async () => {
    const fx = await fixture();
    const rejected = (cycle: number) => reviewResult(fx.requirementId, { verdict: 'REWORK_REQUIRED', findings: [{ id: randomUUID(), category: 'CORRECTNESS', severity: 'HIGH', path: fx.path, message: `still incorrect cycle ${cycle}`, requirementIds: [fx.requirementId] }] });
    const change = (cycle: number) => ({ changes: [{ operation: 'MODIFY', path: fx.path, content: `${fx.candidate}\n// rework ${cycle}`, rationale: `Rework ${cycle}` }], requirementCoverageSummary: [{ requirementId: fx.requirementId, implementationNote: `Rework ${cycle}` }], confidence: 0.8 });
    fake.queue.push(response(rejected(1)), response(change(1)), response(rejected(2)), response(change(2)), response(rejected(3)));
    const runner = new PassingRunner();
    const workspaceValidation = new WorkspaceValidationService(new WorkspaceSessionService(prisma, workspace), workspace, new CandidateBuildRunner(prisma, runner as never), new CandidateTestRunner(prisma, runner as never), eventLog);
    const jobScope = new JobScopeService(prisma);
    const duplicate = new DuplicateValidationService(prisma, new RepositoryInspector(prisma, workspace));
    const engine = new GenerationEngineService(prisma, {} as never, workspace, {} as never, executions, {} as never, {} as never, {} as never, new EventBusService(), catalog, runtime, eventLog, jobScope, duplicate, workspaceValidation, orchestrator);
    const outcome = await (engine as unknown as { runReviewAndExternalRework(input: { missionId: string; job: { requirementId: string; requirementText: string; targetResource: string; targetFile: string; agentKey: string }; generationJobId: string; workspaceSessionId: string; executorAgentExecutionId: string }): Promise<{ status: string; errorCode: string | null }> }).runReviewAndExternalRework({
      missionId: fx.missionId, generationJobId: fx.jobId, workspaceSessionId: fx.sessionId, executorAgentExecutionId: fx.executorId,
      job: { requirementId: fx.requirementId, requirementText: 'GET /health returns uptimeSeconds', targetResource: 'Health', targetFile: fx.path, agentKey: 'backend.nestjs.developer' },
    });
    expect(outcome).toMatchObject({ status: 'BLOCKED_NEEDS_HUMAN', errorCode: 'BLOCKED_NEEDS_HUMAN' });
    expect(await prisma.agentExecution.count({ where: { missionId: fx.missionId, reason: 'REVIEW_REWORK' } })).toBe(2);
    expect(await prisma.workspaceSession.count({ where: { missionId: fx.missionId } })).toBe(3);
    expect(await prisma.reviewRecord.count({ where: { missionId: fx.missionId } })).toBe(3);
    expect(await prisma.eventLog.count({ where: { missionId: fx.missionId, type: 'job.blocked_needs_human' } })).toBe(1);
    expect(fake.calls).toHaveLength(5);
  });

  it('AP: a LEGACY_COMPATIBILITY candidate enters the same production review path without bypass', async () => {
    const fx = await fixture();
    await prisma.generationJob.update({ where: { id: fx.jobId }, data: { executionMode: 'LEGACY_COMPATIBILITY' } });
    fake.queue.push(response(reviewResult(fx.requirementId)));
    const engine = new GenerationEngineService(prisma, {} as never, workspace, {} as never, executions, {} as never, {} as never, {} as never, new EventBusService(), catalog, runtime, eventLog, new JobScopeService(prisma), {} as never, {} as never, orchestrator);
    const outcome = await (engine as unknown as { runReviewAndExternalRework(input: { missionId: string; job: { requirementId: string; requirementText: string; targetResource: string; targetFile: string; agentKey: string }; generationJobId: string; workspaceSessionId: string; executorAgentExecutionId: string }): Promise<{ status: string }> }).runReviewAndExternalRework({
      missionId: fx.missionId, generationJobId: fx.jobId, workspaceSessionId: fx.sessionId, executorAgentExecutionId: fx.executorId,
      job: { requirementId: fx.requirementId, requirementText: 'GET /health returns uptimeSeconds', targetResource: 'Health', targetFile: fx.path, agentKey: 'backend.nestjs.developer' },
    });
    expect(outcome.status).toBe('REVIEW_APPROVED');
    expect(await prisma.reviewRecord.count({ where: { generationJobId: fx.jobId } })).toBe(1);
  });

  it('A: refuses candidates without VALIDATED + build PASS + test PASS evidence', async () => {
    const fx = await fixture();
    await prisma.workspaceSession.update({ where: { id: fx.sessionId }, data: { status: 'BUILD_PASSED' } });
    await expect(orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId })).rejects.toThrow('REVIEW_CANDIDATE_NOT_VALIDATED');
  });

  it('AS/AT: candidate credentials are redacted at runtime and source/prompt/CoT are never persisted', async () => {
    const secret = 'sk-1234567890SECRET';
    const fx = await fixture('backend.nestjs.developer', `export const key = '${secret}'; export const uptimeSeconds = process.uptime();`);
    fake.queue.push(response(reviewResult(fx.requirementId)));
    await orchestrator.startReview({ workspaceSessionId: fx.sessionId, reviewCycle: 1, executorAgentExecutionId: fx.executorId });
    expect(fake.calls[0].user).not.toContain(secret);
    expect(fake.calls[0].user).toContain('[REDACTED_CREDENTIAL]');
    const persisted = {
      reviews: await prisma.reviewRecord.findMany({ where: { missionId: fx.missionId } }),
      findings: await prisma.codeReviewFinding.findMany({ where: { missionId: fx.missionId } }),
      events: await prisma.eventLog.findMany({ where: { missionId: fx.missionId } }),
      snapshots: await prisma.promptSnapshot.findMany({ where: { missionId: fx.missionId } }),
    };
    expect(JSON.stringify(persisted)).not.toContain(secret);
    expect(JSON.stringify(persisted)).not.toContain('process.uptime()');
  });
});
