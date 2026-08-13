import { InMemoryRepairAdvisoryStore, RepairAdvisor } from '../services/repair-advisor';
import { FailureClassifier } from '../services/failure-classifier';

describe('RepairAdvisor', () => {
  it('recommends a security specialist without starting repair', () => {
    const advisory = new RepairAdvisor().advise({ missionId: 'repair-1', taskId: 'task-1', approvedSolutionId: 'solution-1', failureCode: 'AUTH_TEST_FAILED', failureSummary: 'JWT permission denied', affectedStack: 'stack.java.spring-boot', failedGateKey: 'SECURITY_GATE' });
    expect(advisory.likelyCapabilities).toEqual(expect.arrayContaining(['security']));
    expect(advisory.likelySpecialistRole).toBe('SECURITY_SPECIALIST');
    expect(advisory.status).toBe('ADVISORY_ONLY');
    expect(advisory.contextHash).toHaveLength(64);
  });

  it('uses historical repair outcomes to estimate success', () => {
    const advisory = new RepairAdvisor().advise({ missionId: 'repair-2', taskId: 'task-2', approvedSolutionId: 'solution-2', failureCode: 'TEST_FAILED', failureSummary: 'assertion failed', historicalOutcomes: [
      { id: 'outcome-1', missionId: 'repair-2', version: 1, outcomeType: 'REPAIR', featureSchemaVersion: 'v1', features: { failureCode: 'TEST_FAILED' }, decision: 'repair', result: 'fixed', success: true },
      { id: 'outcome-2', missionId: 'repair-2', version: 2, outcomeType: 'REPAIR', featureSchemaVersion: 'v1', features: { failureCode: 'TEST_FAILED' }, decision: 'repair', result: 'failed', success: false },
    ] });
    expect(advisory.estimatedSuccess).toBe(0.5);
    expect(advisory.risk).toBe('MEDIUM');
  });

  it('replays the same advisory from its context hash', () => {
    const store = new InMemoryRepairAdvisoryStore();
    const advisor = new RepairAdvisor(store);
    const input = { missionId: 'repair-3', taskId: 'task-3', approvedSolutionId: 'solution-3', failureCode: 'BUILD_FAILED', failureSummary: 'compile error' };
    expect(advisor.advise(input)).toBe(advisor.advise(input));
    expect(store.findByContextHash(advisor.advise(input).contextHash)?.status).toBe('ADVISORY_ONLY');
  });

  it('accepts a classified FailureSnapshot as advisory input', () => {
    const snapshot = new FailureClassifier().classify({ missionId: 'repair-4', taskId: 'task-4', executionId: 'execution-4', summary: 'API contract integration failed', affectedStack: 'stack.nestjs' });
    const advisory = new RepairAdvisor().adviseSnapshot({ missionId: 'repair-4', approvedSolutionId: 'solution-4', snapshot });
    expect(advisory.failureCode).toBe(snapshot.failureCode);
    expect(advisory.failureSnapshotId).toBe(snapshot.id);
    expect(advisory.likelyCapabilities).toEqual(expect.arrayContaining(['integration']));
  });
});
