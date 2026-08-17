import { randomUUID } from 'node:crypto';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { AgentCatalogService } from '../catalog/agent-catalog.service';
import { seedCatalog } from '../catalog/catalog.seed';
import { EventBusService } from '../events/event-bus.service';
import { EventLogService } from '../events/event-log.service';
import { LlmInvocationLedgerService } from '../ledger/llm-invocation-ledger.service';
import { PrismaService } from '../persistence/prisma.service';
import { PromptMasterService } from '../promptmaster/prompt-master.service';
import { RequirementBaselineService } from '../requirements/requirement-baseline.service';
import { ScopeCoverageService } from '../requirements/scope-coverage.service';
import { SolutionPlanResultV1 } from '../solution-planning/solution-plan-result';
import { SolutionPlanningService } from '../solution-planning/solution-planning.service';
import { StackCatalogService } from '../solution-planning/stack-catalog.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

class FakePlannerLlm implements LlmClient {
  calls: LlmCompletionRequest[] = [];
  private queue: string[] = [];
  push(value: unknown): void { this.queue.push(typeof value === 'string' ? value : JSON.stringify(value)); }
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    this.calls.push(request);
    const text = this.queue.shift();
    if (text === undefined) throw new Error('FAKE_PLANNER_RESPONSE_MISSING');
    return { text, model: 'fake-solution-planner', promptTokens: 50, completionTokens: 80 };
  }
}

function plan(keys: string[], patch: Partial<SolutionPlanResultV1> = {}): SolutionPlanResultV1 {
  return {
    solutionType: 'BACKEND', summary: 'CraftManager backend solution',
    components: [{ key: 'backend-api', name: 'Backend API', kind: 'BACKEND', responsibilities: ['Serve all in-scope capabilities'], requirementKeys: keys }],
    stackSelections: [{ componentKey: 'backend-api', stackKey: 'stack.typescript.nestjs', stackVersion: '10', rationale: 'Supported production generation profile', requirementKeys: keys, confidence: 0.96 }],
    requirementDecisions: keys.map((requirementKey) => ({ requirementKey, disposition: 'COVERED', componentKeys: ['backend-api'], rationale: 'Explicitly covered' })),
    constraints: [], nonFunctionalStrategies: keys.includes('REQ-007') ? [{ requirementKey: 'REQ-007', strategy: 'Architecture must define append-only audit evidence' }] : [],
    assumptions: [], risks: [{ description: 'Architecture details remain for CORE-013', severity: 'LOW' }], confidence: 0.96,
    ...patch,
  };
}

(RUN_DB_TESTS ? describe : describe.skip)('CORE-012 SolutionPlanningService (Postgres + fake provider)', () => {
  let prisma: PrismaService;
  let baselines: RequirementBaselineService;
  let scope: ScopeCoverageService;
  let planning: SolutionPlanningService;
  let llm: FakePlannerLlm;
  const missions: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const eventLog = new EventLogService(prisma, new EventBusService());
    const ledger = new LlmInvocationLedgerService(prisma, eventLog);
    const catalog = new AgentCatalogService(prisma);
    await seedCatalog(catalog);
    baselines = new RequirementBaselineService(prisma, eventLog);
    scope = new ScopeCoverageService(prisma, eventLog, baselines);
    llm = new FakePlannerLlm();
    const promptMaster = new PromptMasterService(catalog, {} as never, ledger, prisma);
    planning = new SolutionPlanningService(prisma, baselines, scope, catalog, promptMaster, ledger, eventLog, new StackCatalogService(), llm);
  });

  afterAll(async () => {
    for (const missionId of missions) await cleanup(missionId);
    await prisma.$disconnect();
  });

  async function cleanup(missionId: string): Promise<void> {
    await prisma.humanApprovalRequest.deleteMany({ where: { missionId } });
    await prisma.approvedSolution.deleteMany({ where: { missionId } });
    await prisma.scopeCoverageDecision.deleteMany({ where: { missionId } });
    await prisma.requirementBaseline.deleteMany({ where: { missionId } });
    await prisma.promptSnapshot.deleteMany({ where: { missionId } });
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } });
    await prisma.agentExecution.deleteMany({ where: { missionId } });
    await prisma.eventLog.deleteMany({ where: { missionId } });
    await prisma.requirement.deleteMany({ where: { missionId } });
    await prisma.discoveryConversation.deleteMany({ where: { missionId } });
  }

  function mission(): string {
    const id = `test-core012-${randomUUID()}`;
    missions.push(id);
    return id;
  }

  async function createRequirements(missionId: string, count: number, options: { nfrAt?: number } = {}) {
    await prisma.requirement.createMany({ data: Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      return {
        id: randomUUID(), missionId, section: number === options.nfrAt ? 'nonFunctional' : 'features',
        content: number === options.nfrAt ? 'Todas as alterações devem ser auditáveis' : `CraftManager requirement ${number}`,
        origin: 'USER', status: 'CONFIRMED', createdBy: 'user', requirementKey: `REQ-${String(number).padStart(3, '0')}`,
        category: number === options.nfrAt ? 'NON_FUNCTIONAL' : 'FUNCTIONAL', source: 'USER_EXPLICIT',
      };
    }) });
  }

  async function readyBaseline(missionId: string, count: number, dispositions: Record<string, 'IN_SCOPE' | 'DEFERRED_USER_APPROVED' | 'NOT_APPLICABLE'> = {}, nfrAt?: number) {
    await createRequirements(missionId, count, { nfrAt });
    const baseline = await baselines.createBaseline(missionId);
    for (const ref of baseline.requirementRefs) {
      const decision = dispositions[ref.requirementKey] ?? 'IN_SCOPE';
      const approvalRef = `approval-${ref.requirementKey}-${missionId}`;
      if (decision === 'DEFERRED_USER_APPROVED') await prisma.humanApprovalRequest.create({ data: { id: approvalRef, missionId, trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: ref.requirementId, subjectHash: baseline.baselineHash, status: 'APPROVED', requestedBy: 'test', decidedBy: 'test-user', decidedAt: new Date(), rationale: 'Deferred in test' } });
      await scope.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision,
        decisionSource: 'USER', ...(decision === 'DEFERRED_USER_APPROVED' ? { approvalRef } : {}),
        ...(decision === 'NOT_APPLICABLE' ? { reason: 'Explicitly not applicable to this solution' } : {}) });
    }
    await baselines.finalizeBaseline(missionId, baseline.id);
    await scope.finalizeCoverage(missionId, baseline.id);
    return baselines.getBaseline(missionId, baseline.id);
  }

  it('requires an exact FINALIZED baseline and ready ScopeCoverage without auto-completing decisions', async () => {
    const missionId = mission();
    await createRequirements(missionId, 1);
    const draft = await baselines.createBaseline(missionId);
    await expect(planning.planAndApprove(missionId, draft.id)).rejects.toThrow('SOLUTION_SCOPE_NOT_READY');
    await baselines.finalizeBaseline(missionId, draft.id);
    await expect(planning.planAndApprove(missionId, draft.id)).rejects.toThrow('SOLUTION_SCOPE_NOT_READY');
    expect(await prisma.scopeCoverageDecision.count({ where: { missionId } })).toBe(0);
  });

  it('CraftManager: plans only 7 IN_SCOPE, freezes v1 evidence, keeps deferred, and records the full cognitive/event chain', async () => {
    const missionId = mission();
    const baseline = await readyBaseline(missionId, 8, { 'REQ-008': 'DEFERRED_USER_APPROVED' }, 7);
    const keys = baseline.requirementsSnapshot.slice(0, 7).map((item) => item.requirementKey);
    llm.push(plan(keys));
    const approved = await planning.planAndApprove(missionId, baseline.id);

    expect(approved.status).toBe('APPROVED');
    expect(approved.requirementBaselineHash).toBe(baseline.baselineHash);
    expect(approved.requirementDecisions.map((item) => item.requirementKey)).toEqual(keys);
    expect(approved.deferredRequirementRefs).toEqual([expect.objectContaining({ requirementKey: 'REQ-008' })]);
    expect(approved.requirementDecisions.some((item) => item.requirementKey === 'REQ-008')).toBe(false);
    expect(approved.nonFunctionalStrategies).toEqual([expect.objectContaining({ requirementKey: 'REQ-007' })]);

    const execution = await prisma.agentExecution.findUniqueOrThrow({ where: { id: approved.planningAgentExecutionId } });
    expect(execution).toMatchObject({ generationJobId: null, agentDefinitionKey: 'architecture.solution-architect', agentDefinitionVersion: 1, mode: 'COGNITIVE', status: 'SUCCEEDED' });
    const prompt = await prisma.promptSnapshot.findUniqueOrThrow({ where: { id: approved.promptSnapshotId } });
    expect(prompt).toMatchObject({ jobId: null, purpose: 'SOLUTION_PLANNING', outputSchemaKey: 'SolutionPlanResultV1', agentDefinitionVersion: 1 });
    expect(await prisma.llmInvocationRecord.count({ where: { agentExecutionId: execution.id } })).toBe(1);

    const events = await prisma.eventLog.findMany({ where: { missionId }, orderBy: { sequence: 'asc' } });
    const types = events.map((event) => event.type);
    expect(types.indexOf('mission.scope_ready')).toBeLessThan(types.indexOf('mission.solution_planning_started'));
    expect(types.indexOf('mission.solution_planning_started')).toBeLessThan(types.indexOf('mission.solution_planning_completed'));
    expect(types.indexOf('mission.solution_planning_completed')).toBeLessThan(types.indexOf('mission.solution_approved'));
    const solutionEvents = events.filter((event) => event.type.startsWith('mission.solution_'));
    expect(JSON.stringify(solutionEvents.map((event) => event.payloadJson))).not.toContain('CraftManager requirement');
    expect(JSON.stringify(solutionEvents.map((event) => event.payloadJson)).toLowerCase()).not.toMatch(/password|credential|chain-of-thought/);
  });

  it('uses the frozen baseline snapshot after the live Requirement changes', async () => {
    const missionId = mission();
    const baseline = await readyBaseline(missionId, 1);
    const live = await prisma.requirement.findFirstOrThrow({ where: { missionId } });
    await prisma.requirement.update({ where: { id: live.id }, data: { content: 'MUTATED LIVE REQUIREMENT' } });
    llm.push(plan(['REQ-001']));
    const approved = await planning.planAndApprove(missionId, baseline.id);
    const call = llm.calls.at(-1)!;
    expect(call.user).toContain('CraftManager requirement 1');
    expect(call.user).not.toContain('MUTATED LIVE REQUIREMENT');
    expect(approved.requirementBaselineHash).toBe(baseline.baselineHash);
  });

  it('keeps DEFERRED and NOT_APPLICABLE traceable without turning either into implementation decisions', async () => {
    const missionId = mission();
    const baseline = await readyBaseline(missionId, 3, { 'REQ-002': 'DEFERRED_USER_APPROVED', 'REQ-003': 'NOT_APPLICABLE' });
    llm.push(plan(['REQ-001']));
    const approved = await planning.planAndApprove(missionId, baseline.id);
    expect(approved.requirementDecisions.map((item) => item.requirementKey)).toEqual(['REQ-001']);
    expect(approved.deferredRequirementRefs).toEqual([expect.objectContaining({ requirementKey: 'REQ-002' })]);
    expect(approved.notApplicableRequirementRefs).toEqual([expect.objectContaining({ requirementKey: 'REQ-003' })]);
  });

  it('performs exactly one schema repair in the same AgentExecution and fails when repair is exhausted', async () => {
    const repairMission = mission();
    const baseline = await readyBaseline(repairMission, 1);
    llm.push('not-json'); llm.push(plan(['REQ-001']));
    const approved = await planning.planAndApprove(repairMission, baseline.id);
    const invocations = await prisma.llmInvocationRecord.findMany({ where: { agentExecutionId: approved.planningAgentExecutionId }, orderBy: { startedAt: 'asc' } });
    expect(invocations.map((item) => item.purpose)).toEqual(['SOLUTION_PLANNING', 'REPAIR']);
    expect(await prisma.promptSnapshot.count({ where: { agentExecutionId: approved.planningAgentExecutionId } })).toBe(2);

    const failedMission = mission();
    const failedBaseline = await readyBaseline(failedMission, 1);
    llm.push('{}'); llm.push('{"still":"invalid"}');
    await expect(planning.planAndApprove(failedMission, failedBaseline.id)).rejects.toThrow('SOLUTION_PLAN_SCHEMA_INVALID');
    const failedExecution = await prisma.agentExecution.findFirstOrThrow({ where: { missionId: failedMission } });
    expect(failedExecution).toMatchObject({ status: 'FAILED', errorCode: 'SOLUTION_PLAN_SCHEMA_INVALID' });
    expect(await prisma.llmInvocationRecord.count({ where: { agentExecutionId: failedExecution.id } })).toBe(2);
  });

  it('passes all 27 IN_SCOPE requirements through prompt, decisions and ApprovedSolution including REQ-027', async () => {
    const missionId = mission();
    const baseline = await readyBaseline(missionId, 27);
    const keys = baseline.requirementsSnapshot.map((item) => item.requirementKey);
    llm.push(plan(keys));
    const approved = await planning.planAndApprove(missionId, baseline.id);
    expect(approved.requirementDecisions).toHaveLength(27);
    expect(approved.requirementDecisions[26].requirementKey).toBe('REQ-027');
    expect(approved.components[0].requirementKeys).toHaveLength(27);
    expect(llm.calls.at(-1)!.user).toContain('REQ-027');
  });

  it.each([
    ['SOLUTION_REQUIREMENT_COVERAGE_INCOMPLETE', (base: SolutionPlanResultV1) => ({ ...base, requirementDecisions: base.requirementDecisions.slice(0, 1) })],
    ['SOLUTION_DUPLICATE_REQUIREMENT_DECISION', (base: SolutionPlanResultV1) => ({ ...base, requirementDecisions: [...base.requirementDecisions, { ...base.requirementDecisions[0] }] })],
    ['SOLUTION_UNKNOWN_REQUIREMENT', (base: SolutionPlanResultV1) => ({ ...base, requirementDecisions: [...base.requirementDecisions, { requirementKey: 'REQ-999', disposition: 'COVERED' as const, componentKeys: ['backend-api'], rationale: 'Invented' }] })],
    ['SOLUTION_UNSUPPORTED_REQUIREMENT', (base: SolutionPlanResultV1) => ({ ...base, requirementDecisions: [{ ...base.requirementDecisions[0], disposition: 'UNSUPPORTED' as const }, ...base.requirementDecisions.slice(1)] })],
    ['STACK_NOT_FOUND', (base: SolutionPlanResultV1) => ({ ...base, stackSelections: [{ ...base.stackSelections[0], stackKey: 'magic.framework' }] })],
    ['STACK_NOT_SUPPORTED', (base: SolutionPlanResultV1) => ({ ...base, stackSelections: [{ ...base.stackSelections[0], stackKey: 'stack.java.spring-boot', stackVersion: '21' }] })],
    ['STACK_VERSION_NOT_SUPPORTED', (base: SolutionPlanResultV1) => ({ ...base, stackSelections: [{ ...base.stackSelections[0], stackVersion: 'latest' }] })],
  ])('blocks validation with %s and never approves', async (errorCode, mutate) => {
    const missionId = mission();
    const baseline = await readyBaseline(missionId, 2);
    llm.push(mutate(plan(['REQ-001', 'REQ-002'])));
    await expect(planning.planAndApprove(missionId, baseline.id)).rejects.toThrow(errorCode);
    expect(await prisma.approvedSolution.count({ where: { missionId, status: 'APPROVED' } })).toBe(0);
    expect(await prisma.eventLog.count({ where: { missionId, type: 'mission.solution_approved' } })).toBe(0);
    expect(await prisma.eventLog.count({ where: { missionId, type: 'mission.solution_validation_failed' } })).toBe(1);
  });

  it('is idempotent for exact semantic output and versions immutably when a new baseline appears', async () => {
    const missionId = mission();
    const baseline1 = await readyBaseline(missionId, 1);
    llm.push(plan(['REQ-001']));
    const v1 = await planning.planAndApprove(missionId, baseline1.id);
    const frozenV1Hash = v1.solutionHash;

    llm.push(plan(['REQ-001']));
    const same = await planning.planAndApprove(missionId, baseline1.id);
    expect(same.id).toBe(v1.id);
    expect(await prisma.approvedSolution.count({ where: { missionId } })).toBe(1);

    await prisma.requirement.updateMany({ where: { missionId }, data: { content: 'Requirement v2' } });
    const baseline2Draft = await baselines.createBaseline(missionId);
    await scope.setDecision({ missionId, requirementId: baseline2Draft.requirementRefs[0].requirementId, requirementBaselineId: baseline2Draft.id, decision: 'IN_SCOPE', decisionSource: 'USER' });
    await baselines.finalizeBaseline(missionId, baseline2Draft.id);
    await scope.finalizeCoverage(missionId, baseline2Draft.id);
    llm.push(plan(['REQ-001'], { summary: 'Version two semantic result' }));
    const v2 = await planning.planAndApprove(missionId, baseline2Draft.id);

    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(v1.id);
    expect(v2.requirementBaselineHash).not.toBe(v1.requirementBaselineHash);
    const old = await planning.getById(missionId, v1.id);
    expect(old.status).toBe('SUPERSEDED');
    expect(old.solutionHash).toBe(frozenV1Hash);
    expect(old.components).toEqual(v1.components);
  });
});
