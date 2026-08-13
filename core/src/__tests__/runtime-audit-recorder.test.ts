import { InMemoryDecisionEventStore } from '../services/decision-event-store';
import { RuntimeAuditRecorder } from '../services/runtime-audit-recorder';
import { ExecutionDispatchResult, RepairAdvisory, ReviewGateEvaluation } from '../domain';

describe('RuntimeAuditRecorder', () => {
  it('records dispatch, gate and repair lifecycle events idempotently', () => {
    const store = new InMemoryDecisionEventStore();
    const recorder = new RuntimeAuditRecorder(store);
    const dispatch = { id: 'dispatch-result', missionId: 'audit-runtime', version: 1, taskId: 'task-1', routingDecisionId: 'route-1', executionId: 'execution-1', status: 'DISPATCHED', contextHash: 'context-1' } as ExecutionDispatchResult;
    const gate = { id: 'gate-1', missionId: 'audit-runtime', version: 1, taskId: 'task-1', routingDecisionId: 'route-1', requiredGateKeys: ['BUILD_GATE'], evaluatedGateKeys: ['BUILD_GATE'], missingGateKeys: [], failedGateKeys: [], duplicateGateKeys: [], unauthorizedReviewerAgentIds: [], unexpectedGateKeys: [], evidenceRefs: ['build-1'], status: 'PASSED', reason: 'ok', evidenceHash: 'evidence-1' } as ReviewGateEvaluation;
    const advisory = { id: 'advisory-1', missionId: 'audit-runtime', version: 1, taskId: 'task-1', approvedSolutionId: 'solution-1', failureCode: 'TEST_FAILED', likelyCapabilities: ['testing'], likelySpecialistRole: 'TEST_ENGINEER', estimatedSuccess: 0.5, risk: 'MEDIUM', rationale: 'test', status: 'ADVISORY_ONLY', contextHash: 'repair-1' } as RepairAdvisory;
    expect(recorder.recordDispatch(dispatch).eventType).toBe('EXECUTION_DISPATCHED');
    expect(recorder.recordExecutionOutcome({ missionId: 'audit-runtime', taskId: 'task-1', executionId: 'execution-1', success: true, evidenceRefs: ['build-1'] }).eventType).toBe('EXECUTION_COMPLETED');
    expect(recorder.recordGateEvaluation(gate).eventType).toBe('GATE_EVALUATED');
    expect(recorder.recordReviewCompleted(gate).eventType).toBe('REVIEW_COMPLETED');
    expect(recorder.recordRepairAdvisory(advisory).eventType).toBe('REPAIR_ADVISORY_CREATED');
    expect(recorder.recordDispatch(dispatch).version).toBe(1);
    expect(store.list('audit-runtime')).toHaveLength(5);
  });
});
