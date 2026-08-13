import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonLearningOutcomeStore } from '../services/json-learning-outcome-store';

describe('JsonLearningOutcomeStore', () => {
  const input = (missionId: string, outcomeKey: string) => ({
    missionId, outcomeKey, outcomeType: 'AGENT_EXECUTION' as const, featureSchemaVersion: 'v1',
    features: { complexity: 'LOW' }, decision: 'route-a', result: 'completed', success: true,
  });

  it('persists outcomes and isolates idempotency by mission', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ldcn-outcomes-')), 'outcomes.json');
    const store = new JsonLearningOutcomeStore(file);
    const first = store.append(input('m1', 'outcome-1'));
    expect(store.append(input('m1', 'outcome-1'))).toEqual(first);
    expect(store.append(input('m1', 'outcome-2')).version).toBe(2);
    expect(() => store.append(input('m2', 'outcome-1'))).toThrow('LEARNING_OUTCOME_IDEMPOTENCY_CONFLICT');
    expect(new JsonLearningOutcomeStore(file).listByMission('m1')).toHaveLength(2);
  });
});
