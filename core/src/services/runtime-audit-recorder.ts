import { ExecutionDispatchResult, FailureSnapshot, GeneratorDecisionEvent, RepairAdvisory, RepairEligibilityDecision, ReviewGateEvaluation } from '../domain';
import { DecisionEventRepository } from './decision-event-store';

/** Records runtime lifecycle decisions without coupling the core to the executor implementation. */
export class RuntimeAuditRecorder {
  constructor(private readonly events: DecisionEventRepository) {}

  recordDispatch(result: ExecutionDispatchResult): GeneratorDecisionEvent {
    return this.events.append({ missionId: result.missionId, eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: result.executionId, idempotencyKey: `execution:${result.missionId}:${result.taskId}:${result.contextHash}`, payload: { taskId: result.taskId, routingDecisionId: result.routingDecisionId, executionId: result.executionId } });
  }

  recordExecutionOutcome(input: { missionId: string; taskId: string; executionId: string; success: boolean; evidenceRefs?: string[] }): GeneratorDecisionEvent {
    const eventType = input.success ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED';
    return this.events.append({ missionId: input.missionId, eventType, aggregateType: 'Execution', aggregateId: input.executionId, idempotencyKey: `execution-outcome:${input.missionId}:${input.executionId}:${input.success}`, payload: { taskId: input.taskId, executionId: input.executionId, success: input.success, evidenceCount: input.evidenceRefs?.length ?? 0 } });
  }

  recordGateEvaluation(evaluation: ReviewGateEvaluation): GeneratorDecisionEvent {
    return this.events.append({ missionId: evaluation.missionId, eventType: 'GATE_EVALUATED', aggregateType: 'ReviewGateEvaluation', aggregateId: evaluation.id, idempotencyKey: `gate:${evaluation.missionId}:${evaluation.routingDecisionId}:${evaluation.evidenceHash}`, payload: { taskId: evaluation.taskId, status: evaluation.status, evaluatedGateCount: evaluation.evaluatedGateKeys.length, failedGateCount: evaluation.failedGateKeys.length } });
  }

  recordReviewCompleted(evaluation: ReviewGateEvaluation): GeneratorDecisionEvent {
    return this.events.append({ missionId: evaluation.missionId, eventType: 'REVIEW_COMPLETED', aggregateType: 'ReviewGateEvaluation', aggregateId: evaluation.id, idempotencyKey: `review:${evaluation.missionId}:${evaluation.id}:${evaluation.status}`, payload: { taskId: evaluation.taskId, status: evaluation.status, failedGateCount: evaluation.failedGateKeys.length } });
  }

  recordRepairAdvisory(advisory: RepairAdvisory): GeneratorDecisionEvent {
    return this.events.append({ missionId: advisory.missionId, eventType: 'REPAIR_ADVISORY_CREATED', aggregateType: 'RepairAdvisory', aggregateId: advisory.id, idempotencyKey: `repair-advisory:${advisory.contextHash}`, payload: { taskId: advisory.taskId, failureCode: advisory.failureCode, specialistRole: advisory.likelySpecialistRole, risk: advisory.risk, failureSnapshotId: advisory.failureSnapshotId ?? null } });
  }

  recordFailureClassification(snapshot: FailureSnapshot): GeneratorDecisionEvent {
    return this.events.append({ missionId: snapshot.missionId, eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: snapshot.id, idempotencyKey: `failure:${snapshot.contextHash}`, payload: { taskId: snapshot.taskId, executionId: snapshot.executionId, snapshotId: snapshot.id, category: snapshot.category, failureCode: snapshot.failureCode, contextHash: snapshot.contextHash } });
  }

  recordRepairEligibility(decision: RepairEligibilityDecision): GeneratorDecisionEvent {
    return this.events.append({ missionId: decision.missionId, eventType: 'REPAIR_ELIGIBILITY_EVALUATED', aggregateType: 'RepairEligibilityDecision', aggregateId: decision.id, idempotencyKey: `repair-eligibility:${decision.missionId}:${decision.taskId}:${decision.attemptCount}:${decision.maxAttempts}:${decision.requiresApproval}`, payload: { taskId: decision.taskId, status: decision.status, attemptCount: decision.attemptCount, maxAttempts: decision.maxAttempts, requiresApproval: decision.requiresApproval } });
  }

  recordRepairOutcome(input: { missionId: string; taskId: string; advisoryContextHash: string; success: boolean; repairCount?: number }): GeneratorDecisionEvent {
    return this.events.append({ missionId: input.missionId, eventType: 'REPAIR_COMPLETED', aggregateType: 'RepairSession', aggregateId: input.advisoryContextHash, idempotencyKey: `repair-completed:${input.missionId}:${input.taskId}:${input.advisoryContextHash}:${input.success}:${input.repairCount ?? 0}`, payload: { taskId: input.taskId, advisoryContextHash: input.advisoryContextHash, success: input.success, repairCount: input.repairCount ?? 0 } });
  }
}
