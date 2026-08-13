import { InMemoryReviewGateEvaluationStore, ReviewGateEvaluator } from '../services/review-gate-evaluator';
import { WorkRoutingDecision } from '../domain';

const decision = (overrides: Partial<WorkRoutingDecision> = {}) => ({ id: 'route-review', missionId: 'review-1', version: 1, taskId: 'task-1', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'executor-1', selectedAgentInstanceIds: ['executor-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: ['BUILD_GATE', 'TEST_GATE'], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'matched', contextHash: 'hash', status: 'ROUTED', ...overrides } as WorkRoutingDecision);

describe('ReviewGateEvaluator', () => {
  it('passes when all required gates have independent evidence', () => {
    const result = new ReviewGateEvaluator().evaluate(decision(), [
      { gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-1'], reviewerAgentInstanceId: 'reviewer-1', executorAgentInstanceId: 'executor-1' },
      { gateKey: 'TEST_GATE', passed: true, evidenceRefs: ['test-1'], reviewerAgentInstanceId: 'reviewer-1', executorAgentInstanceId: 'executor-1' },
    ]);
    expect(result.status).toBe('PASSED');
    expect(result.evidenceRefs).toEqual(['build-1', 'test-1']);
    expect(result.evidenceHash).toHaveLength(64);
  });

  it('blocks missing gates and reviewer conflicts', () => {
    expect(new ReviewGateEvaluator().evaluate(decision(), [{ gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-1'], reviewerAgentInstanceId: 'executor-1' }]).status).toBe('BLOCKED');
  });

  it('fails an evidenced gate that did not pass', () => {
    const result = new ReviewGateEvaluator().evaluate(decision(), [
      { gateKey: 'BUILD_GATE', passed: false, evidenceRefs: ['build-1'], reviewerAgentInstanceId: 'reviewer-1' },
      { gateKey: 'TEST_GATE', passed: true, evidenceRefs: ['test-1'], reviewerAgentInstanceId: 'reviewer-1' },
    ]);
    expect(result.status).toBe('FAILED');
    expect(result.failedGateKeys).toEqual(['BUILD_GATE']);
  });

  it('replays identical evidence through the repository', () => {
    const store = new InMemoryReviewGateEvaluationStore();
    const evaluator = new ReviewGateEvaluator(store);
    const evidence = [{ gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-2'], reviewerAgentInstanceId: 'reviewer-1' }];
    const first = evaluator.evaluate(decision({ requiredGateKeys: ['BUILD_GATE'] }), evidence);
    expect(evaluator.evaluate(decision({ requiredGateKeys: ['BUILD_GATE'] }), evidence)).toBe(first);
  });

  it('blocks duplicate evidence for the same gate', () => {
    const result = new ReviewGateEvaluator().evaluate(decision({ requiredGateKeys: ['BUILD_GATE'] }), [
      { gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-1'], reviewerAgentInstanceId: 'reviewer-1' },
      { gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-2'], reviewerAgentInstanceId: 'reviewer-1' },
    ]);
    expect(result.status).toBe('BLOCKED');
    expect(result.duplicateGateKeys).toEqual(['BUILD_GATE']);
  });

  it('blocks unauthorized reviewers and unexpected gates', () => {
    const result = new ReviewGateEvaluator().evaluate(decision(), [
      { gateKey: 'BUILD_GATE', passed: true, evidenceRefs: ['build-3'], reviewerAgentInstanceId: 'unknown-reviewer' },
      { gateKey: 'TEST_GATE', passed: true, evidenceRefs: ['test-3'], reviewerAgentInstanceId: 'reviewer-1' },
      { gateKey: 'SECRET_GATE', passed: true, evidenceRefs: ['secret-3'], reviewerAgentInstanceId: 'reviewer-1' },
    ]);
    expect(result.status).toBe('BLOCKED');
    expect(result.unauthorizedReviewerAgentIds).toEqual(['unknown-reviewer']);
    expect(result.unexpectedGateKeys).toEqual(['SECRET_GATE']);
  });
});
