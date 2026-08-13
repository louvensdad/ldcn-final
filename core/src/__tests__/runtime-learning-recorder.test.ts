import { InMemoryLearningOutcomeStore } from '../services/learning-outcome-store';
import { RuntimeLearningRecorder } from '../services/runtime-learning-recorder';

describe('RuntimeLearningRecorder', () => {
  it('records execution, gate and repair outcomes append-only', () => {
    const store = new InMemoryLearningOutcomeStore();
    const recorder = new RuntimeLearningRecorder(store);
    expect(recorder.recordExecution({ missionId: 'learning-runtime', taskId: 'task-1', routingDecisionId: 'route-1', success: true, buildPassed: true, testsPassed: true }).outcomeType).toBe('AGENT_EXECUTION');
    expect(recorder.recordGate({ missionId: 'learning-runtime', taskId: 'task-1', evaluationId: 'gate-1', status: 'PASSED', gateCount: 2 }).success).toBe(true);
    expect(recorder.recordRepair({ missionId: 'learning-runtime', taskId: 'task-1', advisoryContextHash: 'repair-1', failureCode: 'TEST_FAILED', success: false }).result).toBe('FAILED');
    expect(recorder.recordExecution({ missionId: 'learning-runtime', taskId: 'task-1', routingDecisionId: 'route-1', success: true })).toBe(store.listByMission('learning-runtime')[0]);
    expect(store.listByMission('learning-runtime')).toHaveLength(3);
  });
});
