import { VersionedEntity } from './shared';

export type ReviewGateEvaluationStatus = 'PASSED' | 'FAILED' | 'BLOCKED';

export interface ReviewGateEvidence {
  gateKey: string;
  passed: boolean;
  evidenceRefs: string[];
  reviewerAgentInstanceId?: string;
  executorAgentInstanceId?: string;
  reason?: string;
}

export interface ReviewGateEvaluation extends VersionedEntity {
  taskId: string;
  routingDecisionId: string;
  requiredGateKeys: string[];
  evaluatedGateKeys: string[];
  missingGateKeys: string[];
  failedGateKeys: string[];
  duplicateGateKeys: string[];
  unauthorizedReviewerAgentIds: string[];
  unexpectedGateKeys: string[];
  evidenceRefs: string[];
  status: ReviewGateEvaluationStatus;
  reason: string;
  evidenceHash: string;
}
