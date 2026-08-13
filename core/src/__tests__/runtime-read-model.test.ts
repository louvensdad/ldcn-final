import { InMemoryDecisionEventStore } from '../services/decision-event-store';
import { InMemoryLearningOutcomeStore } from '../services/learning-outcome-store';
import { RuntimeReadModel } from '../services/runtime-read-model';

describe('RuntimeReadModel', () => {
  it('projects the operational task state from events and outcomes', () => {
    const events = new InMemoryDecisionEventStore();
    const outcomes = new InMemoryLearningOutcomeStore();
    events.append({ missionId: 'read-model-1', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-1', idempotencyKey: 'dispatch-1', payload: { taskId: 'task-1', executionId: 'execution-1' } });
    events.append({ missionId: 'read-model-1', eventType: 'EXECUTION_COMPLETED', aggregateType: 'Execution', aggregateId: 'execution-1', idempotencyKey: 'complete-1', payload: { taskId: 'task-1', executionId: 'execution-1', success: true } });
    events.append({ missionId: 'read-model-1', eventType: 'GATE_EVALUATED', aggregateType: 'ReviewGateEvaluation', aggregateId: 'gate-1', idempotencyKey: 'gate-1', payload: { taskId: 'task-1', status: 'PASSED' } });
    outcomes.append({ outcomeKey: 'outcome-1', missionId: 'read-model-1', taskId: 'task-1', outcomeType: 'AGENT_EXECUTION', featureSchemaVersion: 'runtime-v1', features: {}, decision: 'route-1', result: 'SUCCESS', success: true });
    expect(new RuntimeReadModel(events, outcomes).getTask('read-model-1', 'task-1')).toEqual(expect.objectContaining({ executionStatus: 'COMPLETED', lastGateStatus: 'PASSED', executionId: 'execution-1', outcomeCount: 1, nextAction: 'NONE' }));
  });

  it('returns the next action for a failed execution', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'read-model-2', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-2', idempotencyKey: 'failed-2', payload: { taskId: 'task-2', executionId: 'execution-2', success: false } });
    expect(new RuntimeReadModel(events, new InMemoryLearningOutcomeStore()).getTask('read-model-2', 'task-2')?.nextAction).toBe('REPAIR_ADVISORY');
  });

  it('lists mission tasks in deterministic order', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'read-model-3', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-b', idempotencyKey: 'dispatch-b', payload: { taskId: 'task-b', executionId: 'execution-b' } });
    events.append({ missionId: 'read-model-3', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-a', idempotencyKey: 'dispatch-a', payload: { taskId: 'task-a', executionId: 'execution-a' } });
    expect(new RuntimeReadModel(events, new InMemoryLearningOutcomeStore()).listMission('read-model-3').map((task) => task.taskId)).toEqual(['task-a', 'task-b']);
  });

  it('uses the latest terminal execution event after a retry', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'read-model-4', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-old', idempotencyKey: 'dispatch-old', payload: { taskId: 'task-retry', executionId: 'execution-old' } });
    events.append({ missionId: 'read-model-4', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-old', idempotencyKey: 'failed-old', payload: { taskId: 'task-retry', executionId: 'execution-old', success: false } });
    events.append({ missionId: 'read-model-4', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-new', idempotencyKey: 'dispatch-new', payload: { taskId: 'task-retry', executionId: 'execution-new' } });
    events.append({ missionId: 'read-model-4', eventType: 'EXECUTION_COMPLETED', aggregateType: 'Execution', aggregateId: 'execution-new', idempotencyKey: 'completed-new', payload: { taskId: 'task-retry', executionId: 'execution-new', success: true } });
    expect(new RuntimeReadModel(events, new InMemoryLearningOutcomeStore()).getTask('read-model-4', 'task-retry')).toEqual(expect.objectContaining({ executionStatus: 'COMPLETED', executionId: 'execution-new', attemptCount: 2 }));
  });

  it('requests a retry after a successful repair', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'read-model-5', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-5', idempotencyKey: 'failed-5', payload: { taskId: 'task-5', executionId: 'execution-5', success: false } });
    events.append({ missionId: 'read-model-5', eventType: 'REPAIR_COMPLETED', aggregateType: 'RepairSession', aggregateId: 'repair-5', idempotencyKey: 'repair-5', payload: { taskId: 'task-5', success: true } });
    expect(new RuntimeReadModel(events, new InMemoryLearningOutcomeStore()).getTask('read-model-5', 'task-5')?.nextAction).toBe('RETRY_EXECUTION');
  });

  it('waits for the runtime after the repair retry is dispatched', () => {
    const events = new InMemoryDecisionEventStore();
    events.append({ missionId: 'read-model-6', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-old', idempotencyKey: 'failed-6', payload: { taskId: 'task-6', executionId: 'execution-old', success: false } });
    events.append({ missionId: 'read-model-6', eventType: 'REPAIR_COMPLETED', aggregateType: 'RepairSession', aggregateId: 'repair-6', idempotencyKey: 'repair-6', payload: { taskId: 'task-6', success: true } });
    events.append({ missionId: 'read-model-6', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-new', idempotencyKey: 'dispatch-6', payload: { taskId: 'task-6', executionId: 'execution-new' } });
    expect(new RuntimeReadModel(events, new InMemoryLearningOutcomeStore()).getTask('read-model-6', 'task-6')?.nextAction).toBe('WAIT_RUNTIME');
  });
});
