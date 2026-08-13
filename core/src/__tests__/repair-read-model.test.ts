import { InMemoryDecisionEventStore } from '../services/decision-event-store';
import { RepairReadModel } from '../services/repair-read-model';

describe('RepairReadModel', () => {
  it('projects the repair lifecycle and next action', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'repair-read-1', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-1', idempotencyKey: 'failure-1', payload: { taskId: 'task-1', snapshotId: 'snapshot-1', category: 'TEST', failureCode: 'TEST_ASSERTION' } });
    events.append({ missionId: 'repair-read-1', eventType: 'REPAIR_ADVISORY_CREATED', aggregateType: 'RepairAdvisory', aggregateId: 'advisory-1', idempotencyKey: 'advisory-1', payload: { taskId: 'task-1', failureCode: 'TEST_ASSERTION', specialistRole: 'TEST_ENGINEER', risk: 'MEDIUM' } });
    events.append({ missionId: 'repair-read-1', eventType: 'REPAIR_ELIGIBILITY_EVALUATED', aggregateType: 'RepairEligibilityDecision', aggregateId: 'eligibility-1', idempotencyKey: 'eligibility-1', payload: { taskId: 'task-1', status: 'ELIGIBLE', attemptCount: 1, maxAttempts: 3, requiresApproval: false } });
    expect(new RepairReadModel(events).getTask('repair-read-1', 'task-1')).toEqual(expect.objectContaining({ failureCategory: 'TEST', failureCode: 'TEST_ASSERTION', nextAction: 'START_REPAIR' }));
  });

  it('lists repair tasks in deterministic order', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'repair-read-2', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-b', idempotencyKey: 'failure-b', payload: { taskId: 'task-b', category: 'BUILD', failureCode: 'BUILD_FAILED' } });
    events.append({ missionId: 'repair-read-2', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-a', idempotencyKey: 'failure-a', payload: { taskId: 'task-a', category: 'TEST', failureCode: 'TEST_FAILED' } });
    expect(new RepairReadModel(events).listMission('repair-read-2').map((task) => task.taskId)).toEqual(['task-a', 'task-b']);
  });

  it('does not request retry after a dispatch already followed the repair', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'repair-read-3', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-3', idempotencyKey: 'failure-3', payload: { taskId: 'task-3', category: 'TEST', failureCode: 'TEST_FAILED' } });
    events.append({ missionId: 'repair-read-3', eventType: 'REPAIR_ADVISORY_CREATED', aggregateType: 'RepairAdvisory', aggregateId: 'advisory-3', idempotencyKey: 'advisory-3', payload: { taskId: 'task-3', failureCode: 'TEST_FAILED', specialistRole: 'TEST_ENGINEER', risk: 'MEDIUM' } });
    events.append({ missionId: 'repair-read-3', eventType: 'REPAIR_ELIGIBILITY_EVALUATED', aggregateType: 'RepairEligibilityDecision', aggregateId: 'eligibility-3', idempotencyKey: 'eligibility-3', payload: { taskId: 'task-3', status: 'ELIGIBLE', attemptCount: 1, maxAttempts: 3, requiresApproval: false } });
    events.append({ missionId: 'repair-read-3', eventType: 'REPAIR_COMPLETED', aggregateType: 'RepairSession', aggregateId: 'repair-3', idempotencyKey: 'repair-3', payload: { taskId: 'task-3', success: true } });
    events.append({ missionId: 'repair-read-3', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-3', idempotencyKey: 'dispatch-3', payload: { taskId: 'task-3', executionId: 'execution-3' } });
    expect(new RepairReadModel(events).getTask('repair-read-3', 'task-3')?.nextAction).toBe('NONE');
  });
});
