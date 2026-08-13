import { FailureClassifier, InMemoryFailureSnapshotStore } from '../services/failure-classifier';

describe('FailureClassifier', () => {
  it('classifies security failures deterministically', () => {
    const snapshot = new FailureClassifier().classify({ missionId: 'failure-1', taskId: 'task-1', executionId: 'execution-1', summary: 'JWT permission denied', evidenceRefs: ['security-1'], failedGateKey: 'SECURITY_GATE' });
    expect(snapshot.category).toBe('SECURITY');
    expect(snapshot.failureCode).toMatch(/^SECURITY_/);
    expect(snapshot.contextHash).toHaveLength(64);
  });

  it('classifies build, test and integration failures', () => {
    const classifier = new FailureClassifier();
    expect(classifier.classify({ missionId: 'failure-2', taskId: 'task-2', executionId: 'execution-2', summary: 'TypeScript compile error' }).category).toBe('BUILD');
    expect(classifier.classify({ missionId: 'failure-2', taskId: 'task-3', executionId: 'execution-3', summary: 'assertion failed in test' }).category).toBe('TEST');
    expect(classifier.classify({ missionId: 'failure-2', taskId: 'task-4', executionId: 'execution-4', summary: 'API contract integration failed' }).category).toBe('INTEGRATION');
  });

  it('rejects an incomplete snapshot', () => {
    expect(() => new FailureClassifier().classify({} as never)).toThrow('FAILURE_SNAPSHOT_INCOMPLETE');
  });

  it('replays identical snapshots from the repository', () => {
    const classifier = new FailureClassifier(new InMemoryFailureSnapshotStore());
    const input = { missionId: 'failure-3', taskId: 'task-3', executionId: 'execution-3', summary: 'timeout in runtime' };
    expect(classifier.classify(input)).toBe(classifier.classify(input));
  });
});
