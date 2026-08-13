import { InMemoryLearningOutcomeStore } from '../services/learning-outcome-store';

describe('InMemoryLearningOutcomeStore', () => {
  it('is idempotent and versions outcomes per mission', () => {
    const store = new InMemoryLearningOutcomeStore();
    const input = { outcomeKey: 'build:task-1', missionId: 'outcomes-1', outcomeType: 'BUILD' as const, featureSchemaVersion: 'features-v1', features: {}, decision: 'policy', result: 'passed', success: true };
    const first = store.append(input);
    expect(store.append(input)).toBe(first);
    const second = store.append({ ...input, outcomeKey: 'test:task-1', outcomeType: 'TEST', result: 'passed' });
    expect(second.version).toBe(2);
    expect(store.listByMission('outcomes-1')).toHaveLength(2);
  });

  it('blocks outcome key reuse across missions', () => {
    const store = new InMemoryLearningOutcomeStore();
    const input = { outcomeKey: 'shared-outcome', missionId: 'outcome-cross-a', outcomeType: 'REPAIR' as const, featureSchemaVersion: 'v1', features: {}, decision: 'repair', result: 'fixed', success: true };
    store.append(input);
    expect(() => store.append({ ...input, missionId: 'outcome-cross-b' })).toThrow('LEARNING_OUTCOME_IDEMPOTENCY_CONFLICT');
  });
});
