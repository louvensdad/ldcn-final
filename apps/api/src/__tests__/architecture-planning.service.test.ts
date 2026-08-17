import { randomUUID } from 'node:crypto';
import { LlmClient, LlmCompletionRequest, LlmCompletionResult } from '../assistant/deepseek-client';
import { ArchitectureArbitrationResultV1, ArchitectureProposalV1, ArchitectureReviewResultV1 } from '../architecture-planning/architecture-contracts';
import { ArchitecturePlanningService } from '../architecture-planning/architecture-planning.service';
import { HumanApprovalService } from '../approvals/human-approval.service';
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

class FakeArchitectureLlm implements LlmClient {
  calls: LlmCompletionRequest[] = []; private queue: string[] = [];
  push(value: unknown) { this.queue.push(typeof value === 'string' ? value : JSON.stringify(value)); }
  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> { this.calls.push(request); const text = this.queue.shift(); if (text === undefined) throw new Error('FAKE_ARCHITECTURE_RESPONSE_MISSING'); return { text, model: 'fake-architecture', promptTokens: 60, completionTokens: 90 }; }
}

const solutionPlan = (requirements: string[], requiredDecision = false): SolutionPlanResultV1 => ({
  solutionType: 'BACKEND', summary: 'CraftManager API',
  components: [{ key: 'backend-api', name: 'Backend API', kind: 'BACKEND', responsibilities: ['approved scope'], requirementKeys: requirements }],
  stackSelections: [{ componentKey: 'backend-api', stackKey: 'stack.typescript.nestjs', stackVersion: '10', rationale: 'Frozen supported stack', requirementKeys: requirements, confidence: 0.97 }],
  requirementDecisions: requirements.map((requirementKey, index) => ({ requirementKey, disposition: index === 0 && requiredDecision ? 'REQUIRES_ARCHITECTURE_DECISION' : 'COVERED', componentKeys: ['backend-api'], rationale: 'Explicitly traced' })),
  constraints: ['No solution expansion'], nonFunctionalStrategies: requirements.includes('REQ-007') ? [{ requirementKey: 'REQ-007', strategy: 'Append-only auditability decision' }] : [], assumptions: [], risks: [], confidence: 0.97,
});

const proposal = (requirements: string[]): ArchitectureProposalV1 => ({
  architectureStyle: 'modular monolith', summary: 'NestJS modular architecture',
  modules: [{ key: 'api', name: 'Craft API', responsibilities: ['serve approved requirements'], componentKeys: ['backend-api'], requirementKeys: requirements, stackRefs: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }], dependsOn: [] }],
  decisions: [{ key: 'adr-audit', title: 'Auditable state changes', decision: 'Persist append-only audit events', rationale: 'Satisfies frozen auditability requirement', requirementKeys: requirements, componentKeys: ['backend-api'], moduleKeys: ['api'], stackRefs: [{ stackKey: 'stack.typescript.nestjs', stackVersion: '10' }] }],
  integrations: [], dataFlows: [{ key: 'request-flow', description: 'Validated API request', moduleKeys: ['api'], requirementKeys: requirements }], securityBoundaries: [{ key: 'api-boundary', description: 'Authenticated API boundary', moduleKeys: ['api'], requirementKeys: requirements }],
  requirementMappings: requirements.map(requirementKey => ({ requirementKey, moduleKeys: ['api'], decisionKeys: ['adr-audit'] })), risks: [], assumptions: [], confidence: 0.96,
});

const review = (requirements: string[], finding?: ArchitectureReviewResultV1['findings'][number]): ArchitectureReviewResultV1 => ({
  verdict: finding ? 'CHANGES_REQUIRED' : 'APPROVED', summary: finding ? 'Resolution required' : 'Architecture is valid', findings: finding ? [finding] : [], requirementAssessment: requirements.map(requirementKey => ({ requirementKey, status: 'SATISFIED', evidenceSummary: 'Mapped to module and ADR' })), confidence: 0.94,
});

(RUN_DB_TESTS ? describe : describe.skip)('CORE-013 ArchitecturePlanningService (Postgres + fake provider)', () => {
  let prisma: PrismaService, baselines: RequirementBaselineService, scope: ScopeCoverageService, solutionPlanning: SolutionPlanningService, architecture: ArchitecturePlanningService, approvals: HumanApprovalService, llm: FakeArchitectureLlm;
  const missions: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(); await prisma.$connect();
    const events = new EventLogService(prisma, new EventBusService()); const ledger = new LlmInvocationLedgerService(prisma, events); const catalog = new AgentCatalogService(prisma); await seedCatalog(catalog);
    baselines = new RequirementBaselineService(prisma, events); scope = new ScopeCoverageService(prisma, events, baselines); llm = new FakeArchitectureLlm(); const prompts = new PromptMasterService(catalog, {} as never, ledger, prisma);
    solutionPlanning = new SolutionPlanningService(prisma, baselines, scope, catalog, prompts, ledger, events, new StackCatalogService(), llm);
    approvals = new HumanApprovalService(prisma, events); architecture = new ArchitecturePlanningService(prisma, baselines, scope, catalog, prompts, ledger, events, approvals, llm);
  });
  afterAll(async () => { for (const missionId of missions) await cleanup(missionId); await prisma.$disconnect(); });

  async function cleanup(missionId: string) {
    await prisma.humanApprovalRequest.deleteMany({ where: { missionId } }); await prisma.missionControl.deleteMany({ where: { missionId } });
    await prisma.architectureReviewFinding.deleteMany({ where: { missionId } }); await prisma.architectureReviewerExecution.deleteMany({ where: { missionId } }); await prisma.architectureReview.deleteMany({ where: { missionId } });
    const compositions = await prisma.architectureComposition.findMany({ where: { missionId }, select: { id: true } }); await prisma.architectureArbitration.deleteMany({ where: { architectureCompositionId: { in: compositions.map(x => x.id) } } }); await prisma.architectureComposition.deleteMany({ where: { missionId } });
    await prisma.approvedSolution.deleteMany({ where: { missionId } }); await prisma.scopeCoverageDecision.deleteMany({ where: { missionId } }); await prisma.requirementBaseline.deleteMany({ where: { missionId } });
    await prisma.llmInvocationRecord.deleteMany({ where: { missionId } }); await prisma.promptSnapshot.deleteMany({ where: { missionId } }); await prisma.agentExecution.deleteMany({ where: { missionId } }); await prisma.eventLog.deleteMany({ where: { missionId } }); await prisma.requirement.deleteMany({ where: { missionId } });
  }
  async function fixture(count: number, deferred = false, requiredDecision = false) {
    const missionId = `test-core013-${randomUUID()}`; missions.push(missionId);
    await prisma.requirement.createMany({ data: Array.from({ length: count }, (_, i) => ({ id: randomUUID(), missionId, section: i === 6 ? 'nonFunctional' : 'features', content: i === 6 ? 'All changes must remain auditable' : `CraftManager frozen requirement ${i + 1}`, origin: 'USER', status: 'CONFIRMED', createdBy: 'user', requirementKey: `REQ-${String(i + 1).padStart(3, '0')}`, category: i === 6 ? 'NON_FUNCTIONAL' : 'FUNCTIONAL', source: 'USER_EXPLICIT' })) });
    const baseline = await baselines.createBaseline(missionId);
    for (const ref of baseline.requirementRefs) { const isDeferred = deferred && ref.requirementKey === `REQ-${String(count).padStart(3, '0')}`; const approvalRef = `approval-${ref.requirementKey}-${missionId}`; if (isDeferred) await prisma.humanApprovalRequest.create({ data: { id: approvalRef, missionId, trigger: 'REQUIREMENT_WAIVER', subjectType: 'Requirement', subjectId: ref.requirementId, subjectHash: baseline.baselineHash, status: 'APPROVED', requestedBy: 'test', decidedBy: 'test-user', decidedAt: new Date(), rationale: 'Deferred by test user' } }); await scope.setDecision({ missionId, requirementId: ref.requirementId, requirementBaselineId: baseline.id, decision: isDeferred ? 'DEFERRED_USER_APPROVED' : 'IN_SCOPE', decisionSource: 'USER', ...(isDeferred ? { approvalRef } : {}) }); }
    await baselines.finalizeBaseline(missionId, baseline.id); await scope.finalizeCoverage(missionId, baseline.id); const frozen = await baselines.getBaseline(missionId, baseline.id); const requirements = frozen.requirementsSnapshot.filter(x => !(deferred && x.requirementKey === `REQ-${String(count).padStart(3, '0')}`)).map(x => x.requirementKey);
    llm.push(solutionPlan(requirements, requiredDecision)); const solution = await solutionPlanning.planAndApprove(missionId, baseline.id); return { missionId, baseline: frozen, requirements, solution };
  }
  function pushHappy(requirements: string[]) { llm.push(proposal(requirements)); llm.push(review(requirements)); llm.push(review(requirements)); }
  async function startAndApprove(missionId: string, solutionId: string) { const proposed = await architecture.start(missionId, solutionId); const request = await prisma.humanApprovalRequest.findUniqueOrThrow({ where: { id: proposed.humanApprovalRequestId } }); await approvals.decide(missionId, request.id, { decision: 'APPROVED', decidedBy: 'test-user', rationale: 'Approved in integration test' }); return architecture.start(missionId, solutionId); }

  it('CraftManager 7+1 happy path freezes exact inputs, evidence, safe ordered events and creates no Job', async () => {
    const fx = await fixture(8, true, true); const live = await prisma.requirement.findFirstOrThrow({ where: { missionId: fx.missionId, requirementKey: 'REQ-001' } }); await prisma.requirement.update({ where: { id: live.id }, data: { content: 'MUTATED LIVE REQUIREMENT' } });
    pushHappy(fx.requirements); const result = await startAndApprove(fx.missionId, fx.solution.id);
    expect(result).toMatchObject({ status: 'APPROVED', approvedSolutionId: fx.solution.id, approvedSolutionVersion: fx.solution.version, solutionHash: fx.solution.solutionHash, requirementBaselineHash: fx.baseline.baselineHash });
    expect(result.requirementMappings).toHaveLength(7); expect(result.requirementMappings.some((x: any) => x.requirementKey === 'REQ-008')).toBe(false); expect(result.exactStackSelections).toEqual(fx.solution.stackSelections);
    const executions = await prisma.agentExecution.findMany({ where: { missionId: fx.missionId, reason: { in: ['ARCHITECTURE_PROPOSAL','ARCHITECTURE_REVIEW'] } }, orderBy: { startedAt: 'asc' } });
    expect(executions.map(x => [x.agentDefinitionKey, x.agentDefinitionVersion, x.mode, x.status])).toEqual([['architecture.solution-architect',1,'COGNITIVE','SUCCEEDED'],['backend.nestjs.architect',1,'COGNITIVE','SUCCEEDED'],['architecture.security-architect',1,'COGNITIVE','SUCCEEDED']]);
    expect(new Set(executions.map(x => x.id)).size).toBe(3); expect(await prisma.promptSnapshot.count({ where: { missionId: fx.missionId, purpose: { in: ['ARCHITECTURE_PROPOSAL','ARCHITECTURE_REVIEW'] } } })).toBe(3); expect(await prisma.llmInvocationRecord.count({ where: { agentExecutionId: { in: executions.map(x => x.id) } } })).toBe(3);
    expect(llm.calls.at(-3)!.user).toContain('CraftManager frozen requirement 1'); expect(llm.calls.at(-3)!.user).not.toContain('MUTATED LIVE REQUIREMENT');
    const canonicalReview = await prisma.architectureReview.findFirstOrThrow({ where: { missionId: fx.missionId, reviewMode: 'CANONICAL_COUNCIL' } }); expect(canonicalReview.approvedSolutionId).toBe(fx.solution.id); expect(await prisma.architectureReviewerExecution.count({ where: { architectureReviewId: canonicalReview.id } })).toBe(2);
    expect(await prisma.generationJob.count({ where: { missionId: fx.missionId } })).toBe(0);
    const eventRows = await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } }); const types = eventRows.map(x => x.type); for (const type of ['mission.architecture_planning_started','mission.architecture_proposed','mission.architecture_review_started','mission.architecture_review_completed','approval.requested','approval.decided']) expect(types).toContain(type);
    expect(JSON.stringify(eventRows.filter(x => x.type.startsWith('mission.architecture_')).map(x => x.payloadJson))).not.toContain('CraftManager frozen requirement');
    expect(await architecture.start(fx.missionId, fx.solution.id)).toEqual(result);

    const persistedV1 = await prisma.architectureComposition.findUniqueOrThrow({ where: { id: result.id } });
    const source = await prisma.approvedSolution.findUniqueOrThrow({ where: { id: fx.solution.id } });
    const { id: _id, createdAt: _createdAt, approvedAt: _approvedAt, ...copy } = source;
    const solutionV2 = await prisma.approvedSolution.create({ data: { ...copy, id: randomUUID(), version: 2, solutionPlanResultHash: `${source.solutionPlanResultHash}-v2`, solutionHash: `${source.solutionHash}-v2`, approvedAt: new Date() } as any });
    pushHappy(fx.requirements); const v2 = await startAndApprove(fx.missionId, solutionV2.id);
    expect(v2.version).toBe(2); expect((await prisma.architectureComposition.findUniqueOrThrow({ where: { id: result.id } }))).toMatchObject({ status: 'SUPERSEDED', architectureHash: persistedV1.architectureHash, modulesJson: persistedV1.modulesJson });
    expect(await prisma.architectureComposition.count({ where: { missionId: fx.missionId } })).toBe(2);
  });

  it('preserves all 27 IN_SCOPE mappings through the canonical composition', async () => { const fx = await fixture(27); pushHappy(fx.requirements); const result = await startAndApprove(fx.missionId, fx.solution.id); expect(result.requirementMappings).toHaveLength(27); expect(result.requirementMappings.at(-1).requirementKey).toBe('REQ-027'); });

  it('uses one schema correction in the same proposal execution and fails after the maximum', async () => {
    const repaired = await fixture(1); llm.push('not-json'); pushHappy(repaired.requirements); const result = await startAndApprove(repaired.missionId, repaired.solution.id); const execution = await prisma.agentExecution.findUniqueOrThrow({ where: { id: (await prisma.architectureComposition.findUniqueOrThrow({ where: { id: result.id } })).proposalAgentExecutionId } }); expect(await prisma.llmInvocationRecord.count({ where: { agentExecutionId: execution.id } })).toBe(2); expect(await prisma.promptSnapshot.count({ where: { agentExecutionId: execution.id } })).toBe(2);
    const failed = await fixture(1); llm.push('{}'); llm.push('{"still":"invalid"}'); await expect(architecture.start(failed.missionId, failed.solution.id)).rejects.toThrow('ARCHITECTURE_PROPOSAL_SCHEMA_INVALID'); const failedExecution = await prisma.agentExecution.findFirstOrThrow({ where: { missionId: failed.missionId, reason: 'ARCHITECTURE_PROPOSAL' } }); expect(failedExecution).toMatchObject({ status: 'FAILED', errorCode: 'ARCHITECTURE_PROPOSAL_SCHEMA_INVALID' });
  });

  it('runs an independent versioned arbiter, revalidates its final architecture, then approves', async () => {
    const fx = await fixture(2); const high = (id: string): ArchitectureReviewResultV1['findings'][number] => ({ id, category: 'DEPENDENCY', severity: 'HIGH', message: 'Boundary conflict', moduleKeys: ['api'], requirementKeys: ['REQ-001'], proposedResolution: 'Resolve explicitly' }); llm.push(proposal(fx.requirements)); llm.push(review(fx.requirements, high('backend-high'))); llm.push(review(fx.requirements, { ...high('security-high'), category: 'SECURITY' }));
    const arbitration: ArchitectureArbitrationResultV1 = { verdict: 'RESOLVED', resolutionSummary: 'Keep bounded modular architecture', resolutions: [{ findingId: 'backend-high', action: 'MODIFY_ARCHITECTURE', rationale: 'Explicit boundary retained' }, { findingId: 'security-high', action: 'ACCEPT_PROPOSAL', rationale: 'Security boundary is adequate' }], unresolvedFindingIds: [], finalArchitecture: proposal(fx.requirements), confidence: 0.91 }; llm.push(arbitration);
    const result = await startAndApprove(fx.missionId, fx.solution.id); expect(result.status).toBe('APPROVED'); const row = await prisma.architectureArbitration.findUniqueOrThrow({ where: { architectureCompositionId: result.id } }); expect(row).toMatchObject({ agentDefinitionKey: 'architecture.arbiter', agentDefinitionVersion: 1, verdict: 'RESOLVED' });
    const execution = await prisma.agentExecution.findUniqueOrThrow({ where: { id: row.agentExecutionId } }); expect(execution).toMatchObject({ mode: 'COGNITIVE', status: 'SUCCEEDED' }); expect(await prisma.promptSnapshot.count({ where: { agentExecutionId: execution.id, purpose: 'ARCHITECTURE_ARBITRATION' } })).toBe(1); expect(await prisma.llmInvocationRecord.count({ where: { agentExecutionId: execution.id } })).toBe(1);
    const types = (await prisma.eventLog.findMany({ where: { missionId: fx.missionId }, orderBy: { sequence: 'asc' } })).map(x => x.type); expect(types.indexOf('mission.architecture_review_completed')).toBeLessThan(types.indexOf('mission.architecture_conflict_detected')); expect(types.indexOf('mission.architecture_conflict_detected')).toBeLessThan(types.indexOf('mission.architecture_arbitration_started')); expect(types.indexOf('mission.architecture_arbitration_completed')).toBeLessThan(types.indexOf('approval.requested'));
  });

  it('persists and emits ARCHITECTURE_CONFLICT for unresolved arbitration and rejects non-approved input', async () => {
    const fx = await fixture(1); await prisma.approvedSolution.update({ where: { id: fx.solution.id }, data: { status: 'DRAFT' } }); await expect(architecture.start(fx.missionId, fx.solution.id)).rejects.toThrow('ARCHITECTURE_SOLUTION_NOT_APPROVED'); await prisma.approvedSolution.update({ where: { id: fx.solution.id }, data: { status: 'APPROVED' } });
    const high = { id: 'blocking', category: 'SECURITY' as const, severity: 'BLOCKER' as const, message: 'Unresolved threat', requirementKeys: ['REQ-001'] }; llm.push(proposal(fx.requirements)); llm.push(review(fx.requirements, high)); llm.push(review(fx.requirements)); llm.push({ verdict: 'BLOCKED_NEEDS_HUMAN', resolutionSummary: 'Cannot resolve safely', resolutions: [], unresolvedFindingIds: ['blocking'], confidence: 0.8 });
    await expect(architecture.start(fx.missionId, fx.solution.id)).rejects.toThrow('ARCHITECTURE_CONFLICT'); expect(await prisma.architectureComposition.findUniqueOrThrow({ where: { approvedSolutionId: fx.solution.id } })).toMatchObject({ status: 'ARCHITECTURE_CONFLICT' }); expect(await prisma.eventLog.count({ where: { missionId: fx.missionId, type: 'mission.architecture_blocked' } })).toBe(1); expect(await prisma.generationJob.count({ where: { missionId: fx.missionId } })).toBe(0);
  });
});
