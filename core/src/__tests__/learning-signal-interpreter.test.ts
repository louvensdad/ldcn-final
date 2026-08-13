import { LearningSignalInterpreter } from '../services/learning-signal-interpreter';
import { LearningOutcome } from '../domain';

const outcome = (overrides: Partial<LearningOutcome>): LearningOutcome => ({ id: 'id', missionId: 'm', version: 1, outcomeType: 'BUILD', featureSchemaVersion: 'features-v1', features: {}, decision: 'policy', result: 'ok', success: true, ...overrides });

describe('LearningSignalInterpreter', () => {
  it('aggregates historical outcomes without changing decisions', () => {
    const signals = new LearningSignalInterpreter().interpret([
      outcome({ success: true, cost: 10, durationMs: 100, repairCount: 0, buildPassed: true, testsPassed: true, userAccepted: true }),
      outcome({ id: 'id-2', success: false, cost: 20, durationMs: 300, repairCount: 1, buildPassed: false, testsPassed: false, userAccepted: false }),
    ]);
    expect(signals).toEqual(expect.objectContaining({ sampleCount: 2, successRate: 0.5, repairRate: 0.5, averageCost: 15, averageDurationMs: 200, buildPassRate: 0.5 }));
  });

  it('returns neutral empty signals', () => {
    expect(new LearningSignalInterpreter().interpret([])).toEqual({ sampleCount: 0, successRate: 0, repairRate: 0 });
  });
});
