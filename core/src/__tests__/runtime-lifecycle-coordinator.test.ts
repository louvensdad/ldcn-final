import { InMemoryDecisionEventStore } from '../services/decision-event-store';
import { InMemoryLearningOutcomeStore } from '../services/learning-outcome-store';
import { RuntimeLifecycleCoordinator } from '../services/runtime-lifecycle-coordinator';
import { ExecutionContextBuilder } from '../services/execution-context-builder';
import { WorkRoutingDecision } from '../domain';
import { InMemoryExecutionDispatchStore } from '../services/execution-dispatcher';
import { InMemoryReviewGateEvaluationStore } from '../services/review-gate-evaluator';
import { InMemoryRepairAdvisoryStore } from '../services/repair-advisor';
import { createHash } from 'crypto';
import { InMemoryFailureSnapshotStore } from '../services/failure-classifier';

describe('RuntimeLifecycleCoordinator', () => {
  it('coordinates dispatch, completion, gates and repair advisory', () => {
    const events = new InMemoryDecisionEventStore();
    const outcomes = new InMemoryLearningOutcomeStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-flow-1' }) }, events, outcomes);
    const decision = { id: 'route-flow-1', missionId: 'runtime-flow', version: 1, taskId: 'task-flow', approvedSolutionId: 'solution-flow', executorAgentInstanceId: 'executor-flow', requiredGateKeys: ['BUILD_GATE'], status: 'ROUTED', contextHash: 'route-flow-hash' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-flow', missionSummary: 'summary', approvedSolutionId: 'solution-flow', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-flow', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'route-flow-hash' });
    expect(coordinator.dispatch({ missionId: 'runtime-flow', decision, context }).executionId).toBe('execution-flow-1');
    expect(coordinator.completeExecution({ missionId: 'runtime-flow', taskId: 'task-flow', executionId: 'execution-flow-1', routingDecisionId: 'route-flow-1', success: true }).success).toBe(true);
    expect(coordinator.evaluateGates(decision, [{ gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-flow'], reviewerAgentInstanceId: 'reviewer-flow' }]).status).toBe('PASSED');
    expect(coordinator.adviseRepair({ missionId: 'runtime-flow', taskId: 'task-flow', approvedSolutionId: 'solution-flow', failureCode: 'TEST_FAILED', failureSummary: 'assertion failed' }).status).toBe('ADVISORY_ONLY');
    expect(coordinator.completeRepair({ missionId: 'runtime-flow', taskId: 'task-flow', advisoryContextHash: 'repair-flow', failureCode: 'TEST_FAILED', success: true, repairCount: 1 }).success).toBe(true);
    expect(coordinator.assessRepairEligibility({ missionId: 'runtime-flow', taskId: 'task-flow', risk: 'HIGH' })?.status).toBe('BLOCKED');
    expect(events.listByType('runtime-flow', 'REPAIR_ELIGIBILITY_EVALUATED')).toHaveLength(1);
    expect(events.list('runtime-flow').map((event) => event.eventType)).toEqual(expect.arrayContaining(['EXECUTION_DISPATCHED', 'EXECUTION_COMPLETED', 'GATE_EVALUATED', 'REVIEW_COMPLETED', 'REPAIR_ADVISORY_CREATED', 'REPAIR_COMPLETED']));
    expect(outcomes.listByMission('runtime-flow')).toHaveLength(3);
  });

  it('synchronizes terminal status from the external runtime', () => {
    const events = new InMemoryDecisionEventStore();
    const outcomes = new InMemoryLearningOutcomeStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-sync' }), readStatus: () => ({ status: 'COMPLETED', evidenceRefs: ['artifact-1'], durationMs: 42 }) }, events, outcomes);
    const result = coordinator.syncExecution({ missionId: 'runtime-sync', taskId: 'task-sync', executionId: 'execution-sync', routingDecisionId: 'route-sync' });
    expect(result.status).toBe('COMPLETED');
    expect(result.outcome?.durationMs).toBe(42);
    expect(events.listByType('runtime-sync', 'EXECUTION_COMPLETED')).toHaveLength(1);
  });

  it('does not invent an outcome while execution is running', () => {
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-running' }), readStatus: () => ({ status: 'RUNNING' }) }, new InMemoryDecisionEventStore());
    expect(coordinator.syncExecution({ missionId: 'runtime-running', taskId: 'task-running', executionId: 'execution-running', routingDecisionId: 'route-running' })).toEqual({ status: 'RUNNING' });
  });

  it('rejects a status reported for the wrong task after dispatch', () => {
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-context-check' }), readStatus: () => ({ status: 'COMPLETED' }) }, new InMemoryDecisionEventStore());
    const decision = { id: 'route-context-check', missionId: 'runtime-context-check', version: 1, taskId: 'task-context-check', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', selectedAgentInstanceIds: ['agent-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: [], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'matched', contextHash: 'hash-context-check', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-context-check', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-context-check', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'hash-context-check' });
    coordinator.dispatch({ missionId: 'runtime-context-check', decision, context });
    expect(() => coordinator.syncExecution({ missionId: 'runtime-context-check', taskId: 'other-task', executionId: 'execution-context-check', routingDecisionId: 'route-context-check' })).toThrow('EXECUTION_STATUS_CONTEXT_MISMATCH');
  });

  it('accepts injected repositories for the complete runtime lifecycle', () => {
    const dispatches = new InMemoryExecutionDispatchStore();
    const gates = new InMemoryReviewGateEvaluationStore();
    const advisories = new InMemoryRepairAdvisoryStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-repositories' }) }, new InMemoryDecisionEventStore(), new InMemoryLearningOutcomeStore(), dispatches, gates, advisories);
    const decision = { id: 'route-repositories', missionId: 'runtime-repositories', version: 1, taskId: 'task-repositories', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', selectedAgentInstanceIds: ['agent-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: ['BUILD_GATE'], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'matched', contextHash: 'hash-repositories', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-repositories', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-repositories', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'hash-repositories' });
    coordinator.dispatch({ missionId: 'runtime-repositories', decision, context });
    coordinator.completeExecution({ missionId: 'runtime-repositories', taskId: 'task-repositories', executionId: 'execution-repositories', routingDecisionId: 'route-repositories', success: true });
    const gateEvidence = [{ gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-1'], reviewerAgentInstanceId: 'reviewer-1' }];
    const evaluation = coordinator.evaluateGates(decision, gateEvidence);
    const advisory = coordinator.adviseRepair({ missionId: 'runtime-repositories', taskId: 'task-repositories', approvedSolutionId: 'solution-1', failureCode: 'TEST_FAILED', failureSummary: 'test failed' });
    expect(dispatches.findByIdempotencyKey('runtime-repositories:task-repositories:hash-repositories')).toBeDefined();
    const evidenceHash = createHash('sha256').update(JSON.stringify(gateEvidence)).digest('hex');
    expect(gates.findByIdempotencyKey(`runtime-repositories:${decision.id}:${evidenceHash}`)).toBe(evaluation);
    expect(advisories.findByContextHash(advisory.contextHash)).toBe(advisory);
  });

  it('exposes repair eligibility from the persisted runtime read model', () => {
    const events = new InMemoryDecisionEventStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-eligibility' }) }, events);
    events.append({ missionId: 'runtime-eligibility', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-eligibility', idempotencyKey: 'failed-eligibility', payload: { taskId: 'task-eligibility', executionId: 'execution-eligibility', success: false } });
    const decision = coordinator.assessRepairEligibility({ missionId: 'runtime-eligibility', taskId: 'task-eligibility', risk: 'HIGH' });
    expect(decision?.status).toBe('ELIGIBLE');
  });

  it('blocks gate evaluation before execution completion', () => {
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-not-complete' }) }, new InMemoryDecisionEventStore());
    const decision = { id: 'route-not-complete', missionId: 'runtime-not-complete', version: 1, taskId: 'task-not-complete', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', requiredGateKeys: ['BUILD_GATE'], status: 'ROUTED' } as WorkRoutingDecision;
    expect(() => coordinator.evaluateGates(decision, [])).toThrow('REVIEW_EXECUTION_NOT_COMPLETED');
  });

  it('classifies a runtime failure and creates its advisory', () => {
    const events = new InMemoryDecisionEventStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-classify' }) }, events);
    const result = coordinator.classifyAndAdviseRepair({ missionId: 'runtime-classify', taskId: 'task-classify', executionId: 'execution-classify', approvedSolutionId: 'solution-classify', summary: 'API contract integration failed' });
    expect(result.snapshot.category).toBe('INTEGRATION');
    expect(result.advisory.likelyCapabilities).toEqual(expect.arrayContaining(['integration']));
    expect(events.listByType('runtime-classify', 'FAILURE_CLASSIFIED')).toHaveLength(1);
    expect(events.listByType('runtime-classify', 'FAILURE_CLASSIFIED')[0].payload.snapshotId).toBe(result.snapshot.id);
  });

  it('accepts an injected failure snapshot repository', () => {
    const failures = new InMemoryFailureSnapshotStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-failure-repository' }) }, new InMemoryDecisionEventStore(), new InMemoryLearningOutcomeStore(), new InMemoryExecutionDispatchStore(), new InMemoryReviewGateEvaluationStore(), new InMemoryRepairAdvisoryStore(), failures);
    const input = { missionId: 'runtime-failure-repository', taskId: 'task-failure-repository', executionId: 'execution-failure-repository', approvedSolutionId: 'solution-1', summary: 'runtime timeout' };
    const first = coordinator.classifyAndAdviseRepair(input);
    expect(failures.findByContextHash(first.snapshot.contextHash)).toBe(first.snapshot);
  });

  it('keeps repeated failure classification idempotent', () => {
    const events = new InMemoryDecisionEventStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-repeat' }) }, events);
    const input = { missionId: 'runtime-repeat', taskId: 'task-repeat', executionId: 'execution-repeat', approvedSolutionId: 'solution-1', summary: 'test assertion failed' };
    const first = coordinator.classifyAndAdviseRepair(input);
    const retry = coordinator.classifyAndAdviseRepair(input);
    expect(retry.snapshot).toBe(first.snapshot);
    expect(retry.advisory).toBe(first.advisory);
    expect(events.list('runtime-repeat').filter((event) => event.eventType === 'FAILURE_CLASSIFIED')).toHaveLength(1);
    expect(events.list('runtime-repeat').filter((event) => event.eventType === 'REPAIR_ADVISORY_CREATED')).toHaveLength(1);
  });

  it('completes the failed execution recovery lifecycle', () => {
    const events = new InMemoryDecisionEventStore();
    const outcomes = new InMemoryLearningOutcomeStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-recovery-retry' }) }, events, outcomes);
    events.append({ missionId: 'runtime-recovery', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-recovery-old', idempotencyKey: 'failed-recovery', payload: { taskId: 'task-recovery', executionId: 'execution-recovery-old', success: false } });
    const classified = coordinator.classifyAndAdviseRepair({ missionId: 'runtime-recovery', taskId: 'task-recovery', executionId: 'execution-recovery-old', approvedSolutionId: 'solution-recovery', summary: 'test assertion failed' });
    const eligibility = coordinator.assessRepairEligibility({ missionId: 'runtime-recovery', taskId: 'task-recovery', risk: 'MEDIUM' });
    expect(eligibility?.status).toBe('ELIGIBLE');
    coordinator.completeRepair({ missionId: 'runtime-recovery', taskId: 'task-recovery', advisoryContextHash: classified.advisory.contextHash, failureCode: classified.snapshot.failureCode, success: true, repairCount: 1 });
    const retryDecision = { id: 'route-recovery-retry', missionId: 'runtime-recovery', version: 1, taskId: 'task-recovery', approvedSolutionId: 'solution-recovery', jobClassificationId: 'job-recovery', executorAgentInstanceId: 'agent-recovery', selectedAgentInstanceIds: ['agent-recovery'], reviewerCandidateIds: ['reviewer-recovery'], selectedReviewerIds: ['reviewer-recovery'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: [], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'retry', contextHash: 'retry-context', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-recovery', missionSummary: 'summary', approvedSolutionId: 'solution-recovery', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-recovery', taskDescription: 'retry', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'retry-context' });
    expect(coordinator.dispatch({ missionId: 'runtime-recovery', decision: retryDecision, context }).status).toBe('DISPATCHED');
    expect(events.list('runtime-recovery').map((event) => event.eventType)).toEqual(expect.arrayContaining(['EXECUTION_FAILED', 'FAILURE_CLASSIFIED', 'REPAIR_ADVISORY_CREATED', 'REPAIR_ELIGIBILITY_EVALUATED', 'REPAIR_COMPLETED', 'EXECUTION_DISPATCHED']));
  });

  it('blocks redispatch while repair is still pending', () => {
    const events = new InMemoryDecisionEventStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-blocked-retry' }) }, events);
    events.append({ missionId: 'runtime-blocked-retry', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-old', idempotencyKey: 'failed-blocked-retry', payload: { taskId: 'task-blocked-retry', executionId: 'execution-old', success: false } });
    const decision = { id: 'route-blocked-retry', missionId: 'runtime-blocked-retry', version: 1, taskId: 'task-blocked-retry', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', selectedAgentInstanceIds: ['agent-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: [], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'retry', contextHash: 'retry-blocked', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-blocked-retry', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-blocked-retry', taskDescription: 'retry', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'retry-blocked' });
    expect(() => coordinator.dispatch({ missionId: 'runtime-blocked-retry', decision, context })).toThrow('EXECUTION_RETRY_REPAIR_REQUIRED');
  });

  it('blocks dispatch after the configured attempt limit', () => {
    const events = new InMemoryDecisionEventStore();
    const coordinator = new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'execution-limit' }) }, events, new InMemoryLearningOutcomeStore(), new InMemoryExecutionDispatchStore(), new InMemoryReviewGateEvaluationStore(), new InMemoryRepairAdvisoryStore(), new InMemoryFailureSnapshotStore(), { maxExecutionAttempts: 1, maxRepairAttempts: 1 });
    events.append({ missionId: 'runtime-limit', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-old', idempotencyKey: 'dispatch-limit-old', payload: { taskId: 'task-limit', executionId: 'execution-old' } });
    const decision = { id: 'route-limit', missionId: 'runtime-limit', version: 1, taskId: 'task-limit', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', selectedAgentInstanceIds: ['agent-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: [], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'retry', contextHash: 'retry-limit', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'runtime-limit', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-limit', taskDescription: 'retry', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'retry-limit' });
    expect(() => coordinator.dispatch({ missionId: 'runtime-limit', decision, context })).toThrow('EXECUTION_ATTEMPT_LIMIT_REACHED');
  });

  it('rejects invalid runtime policy during composition', () => {
    expect(() => new RuntimeLifecycleCoordinator({ dispatch: () => ({ executionId: 'never' }) }, new InMemoryDecisionEventStore(), new InMemoryLearningOutcomeStore(), new InMemoryExecutionDispatchStore(), new InMemoryReviewGateEvaluationStore(), new InMemoryRepairAdvisoryStore(), new InMemoryFailureSnapshotStore(), { maxExecutionAttempts: 0, maxRepairAttempts: 3 })).toThrow('RUNTIME_EXECUTION_ATTEMPT_POLICY_INVALID');
  });
});
