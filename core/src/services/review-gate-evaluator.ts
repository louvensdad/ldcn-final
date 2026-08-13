import { ReviewGateEvidence, ReviewGateEvaluation, WorkRoutingDecision } from '../domain';
import { generateId } from '../utils/id';
import { createHash } from 'crypto';

export interface ReviewGateEvaluationRepository {
  findByIdempotencyKey(key: string): ReviewGateEvaluation | undefined;
  save(key: string, evaluation: ReviewGateEvaluation): ReviewGateEvaluation;
}

export class InMemoryReviewGateEvaluationStore implements ReviewGateEvaluationRepository {
  private evaluations = new Map<string, ReviewGateEvaluation>();
  findByIdempotencyKey(key: string): ReviewGateEvaluation | undefined { return this.evaluations.get(key); }
  save(key: string, evaluation: ReviewGateEvaluation): ReviewGateEvaluation {
    const existing = this.evaluations.get(key);
    if (existing) return existing;
    this.evaluations.set(key, evaluation);
    return evaluation;
  }
}

/** Evaluates runtime evidence; it does not initiate execution or repair. */
export class ReviewGateEvaluator {
  constructor(private readonly repository: ReviewGateEvaluationRepository = new InMemoryReviewGateEvaluationStore()) {}

  evaluate(decision: WorkRoutingDecision, evidence: readonly ReviewGateEvidence[]): ReviewGateEvaluation {
    if (decision.status !== 'ROUTED' || !decision.executorAgentInstanceId) throw new Error('REVIEW_ROUTING_NOT_READY');
    const evidenceHash = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
    const existing = this.repository.findByIdempotencyKey(`${decision.missionId}:${decision.id}:${evidenceHash}`);
    if (existing) return existing;
    const required = [...new Set(decision.requiredGateKeys)];
    const duplicateGateKeys = [...new Set(evidence.map((item) => item.gateKey).filter((key, index, all) => all.indexOf(key) !== index))];
    const unexpectedGateKeys = [...new Set(evidence.map((item) => item.gateKey).filter((key) => !required.includes(key)))];
    const selectedReviewers = decision.selectedReviewerIds ?? [];
    const reviewerCandidates = decision.reviewerCandidateIds ?? [];
    const authorizedReviewers = new Set(selectedReviewers.length > 0 ? selectedReviewers : reviewerCandidates);
    const reviewerPolicyConfigured = authorizedReviewers.size > 0;
    const unauthorizedReviewerAgentIds = reviewerPolicyConfigured
      ? [...new Set(evidence.map((item) => item.reviewerAgentInstanceId).filter((id): id is string => !!id && !authorizedReviewers.has(id)))]
      : [];
    const byGate = new Map(evidence.map((item) => [item.gateKey, item]));
    const missingGateKeys = required.filter((key) => !byGate.has(key));
    const failedGateKeys = required.filter((key) => {
      const item = byGate.get(key);
      return !!item && (!item.passed || item.evidenceRefs.length === 0);
    });
    const invalidReviewer = evidence.some((item) => item.reviewerAgentInstanceId === decision.executorAgentInstanceId || item.executorAgentInstanceId === item.reviewerAgentInstanceId);
    const evaluatedGateKeys = required.filter((key) => byGate.has(key));
    const evidenceRefs = [...new Set(evidence.flatMap((item) => item.evidenceRefs))];
    const status = invalidReviewer || missingGateKeys.length > 0 || duplicateGateKeys.length > 0 || unauthorizedReviewerAgentIds.length > 0 || unexpectedGateKeys.length > 0 ? 'BLOCKED' : failedGateKeys.length > 0 ? 'FAILED' : 'PASSED';
    const reason = invalidReviewer
      ? 'Reviewer must be different from executor.'
      : duplicateGateKeys.length > 0
        ? `Duplicate evidence for gates: ${duplicateGateKeys.join(', ')}`
      : unauthorizedReviewerAgentIds.length > 0
        ? `Unauthorized reviewers: ${unauthorizedReviewerAgentIds.join(', ')}`
      : unexpectedGateKeys.length > 0
        ? `Unexpected gates: ${unexpectedGateKeys.join(', ')}`
      : missingGateKeys.length > 0
        ? `Missing required gates: ${missingGateKeys.join(', ')}`
        : failedGateKeys.length > 0
          ? `Failed gates: ${failedGateKeys.join(', ')}`
          : 'All required gates passed.';
    return this.repository.save(`${decision.missionId}:${decision.id}:${evidenceHash}`, { id: generateId(), missionId: decision.missionId, version: 1, taskId: decision.taskId, routingDecisionId: decision.id, requiredGateKeys: required, evaluatedGateKeys, missingGateKeys, failedGateKeys, duplicateGateKeys, unauthorizedReviewerAgentIds, unexpectedGateKeys, evidenceRefs, status, reason, evidenceHash });
  }
}
