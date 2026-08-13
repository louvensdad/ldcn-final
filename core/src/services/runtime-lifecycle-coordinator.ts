import { DEFAULT_RUNTIME_POLICY, ExecutionContextSnapshot, ExecutionDispatchResult, FailureSnapshot, LearningOutcome, RepairAdvisory, RepairEligibilityDecision, RepairRisk, ReviewGateEvaluation, ReviewGateEvidence, RuntimePolicyConfig, WorkRoutingDecision } from '../domain';
import { DecisionEventRepository } from './decision-event-store';
import { ExecutionDispatchRepository, ExecutionDispatcher, ExecutionRuntimePort, InMemoryExecutionDispatchStore } from './execution-dispatcher';
import { InMemoryLearningOutcomeStore, LearningOutcomeRepository } from './learning-outcome-store';
import { InMemoryRepairAdvisoryStore, RepairAdvisor, RepairAdvisoryInput, RepairAdvisoryRepository } from './repair-advisor';
import { InMemoryReviewGateEvaluationStore, ReviewGateEvaluationRepository, ReviewGateEvaluator } from './review-gate-evaluator';
import { RuntimeAuditRecorder } from './runtime-audit-recorder';
import { RuntimeLearningRecorder } from './runtime-learning-recorder';
import { RepairEligibilityPolicy } from './repair-eligibility-policy';
import { RuntimeReadModel } from './runtime-read-model';
import { FailureClassifier, FailureClassifierInput, FailureSnapshotRepository, InMemoryFailureSnapshotStore } from './failure-classifier';
import { RuntimePortValidator } from './runtime-port-validator';
import { RuntimePolicyValidator } from './runtime-policy-validator';

export class RuntimeLifecycleCoordinator {
  private readonly dispatcher: ExecutionDispatcher;
  private readonly dispatched = new Map<string, { missionId: string; taskId: string; routingDecisionId: string }>();
  private readonly gates: ReviewGateEvaluator;
  private readonly repairAdvisor: RepairAdvisor;
  private readonly audit: RuntimeAuditRecorder;
  private readonly learning: RuntimeLearningRecorder;
  private readonly readModel: RuntimeReadModel;
  private readonly repairEligibility = new RepairEligibilityPolicy();
  private readonly failureClassifier: FailureClassifier;
  private readonly runtimePolicy: RuntimePolicyConfig;

  constructor(private readonly runtime: ExecutionRuntimePort, events: DecisionEventRepository, outcomes: LearningOutcomeRepository = new InMemoryLearningOutcomeStore(), dispatches: ExecutionDispatchRepository = new InMemoryExecutionDispatchStore(), gateEvaluations: ReviewGateEvaluationRepository = new InMemoryReviewGateEvaluationStore(), advisories: RepairAdvisoryRepository = new InMemoryRepairAdvisoryStore(), failures: FailureSnapshotRepository = new InMemoryFailureSnapshotStore(), policy: RuntimePolicyConfig = DEFAULT_RUNTIME_POLICY) {
    this.runtimePolicy = policy;
    new RuntimePortValidator().assertCompatible(runtime);
    new RuntimePolicyValidator().assertValid(policy);
    this.dispatcher = new ExecutionDispatcher(runtime, dispatches);
    this.gates = new ReviewGateEvaluator(gateEvaluations);
    this.repairAdvisor = new RepairAdvisor(advisories);
    this.failureClassifier = new FailureClassifier(failures);
    this.audit = new RuntimeAuditRecorder(events);
    this.learning = new RuntimeLearningRecorder(outcomes);
    this.readModel = new RuntimeReadModel(events, outcomes);
  }

  syncExecution(input: { missionId: string; taskId: string; executionId: string; routingDecisionId: string }): { status: 'RUNNING' | 'COMPLETED' | 'FAILED'; outcome?: LearningOutcome } {
    const known = this.dispatched.get(input.executionId);
    if (known && (known.missionId !== input.missionId || known.taskId !== input.taskId || known.routingDecisionId !== input.routingDecisionId)) throw new Error('EXECUTION_STATUS_CONTEXT_MISMATCH');
    if (!this.runtime.readStatus) throw new Error('EXECUTION_STATUS_UNSUPPORTED');
    const current = this.runtime.readStatus({ missionId: input.missionId, taskId: input.taskId, executionId: input.executionId });
    if (current.status === 'RUNNING') return current;
    const outcome = this.completeExecution({ missionId: input.missionId, taskId: input.taskId, executionId: input.executionId, routingDecisionId: input.routingDecisionId, success: current.status === 'COMPLETED', durationMs: current.durationMs, evidenceRefs: current.evidenceRefs });
    return { ...current, outcome };
  }

  dispatch(input: { missionId: string; decision: WorkRoutingDecision; context: ExecutionContextSnapshot }): ExecutionDispatchResult {
    const previous = this.readModel.getTask(input.missionId, input.decision.taskId);
    if (previous && previous.executionStatus === 'FAILED' && previous.nextAction !== 'RETRY_EXECUTION') throw new Error('EXECUTION_RETRY_REPAIR_REQUIRED');
    if (previous && previous.attemptCount >= this.runtimePolicy.maxExecutionAttempts) throw new Error('EXECUTION_ATTEMPT_LIMIT_REACHED');
    const result = this.dispatcher.dispatch(input);
    this.audit.recordDispatch(result);
    this.dispatched.set(result.executionId, { missionId: result.missionId, taskId: result.taskId, routingDecisionId: result.routingDecisionId });
    return result;
  }

  completeExecution(input: { missionId: string; taskId: string; executionId: string; routingDecisionId: string; success: boolean; durationMs?: number; evidenceRefs?: string[] }): LearningOutcome {
    this.audit.recordExecutionOutcome(input);
    return this.learning.recordExecution(input);
  }

  evaluateGates(decision: WorkRoutingDecision, evidence: readonly ReviewGateEvidence[]): ReviewGateEvaluation {
    const overview = this.readModel.getTask(decision.missionId, decision.taskId);
    if (!overview || overview.executionStatus !== 'COMPLETED') throw new Error('REVIEW_EXECUTION_NOT_COMPLETED');
    const evaluation = this.gates.evaluate(decision, evidence);
    this.audit.recordGateEvaluation(evaluation);
    this.audit.recordReviewCompleted(evaluation);
    this.learning.recordGate({ missionId: evaluation.missionId, taskId: evaluation.taskId, evaluationId: evaluation.id, status: evaluation.status, gateCount: evaluation.evaluatedGateKeys.length });
    return evaluation;
  }

  adviseRepair(input: RepairAdvisoryInput): RepairAdvisory {
    const advisory = this.repairAdvisor.advise(input);
    this.audit.recordRepairAdvisory(advisory);
    return advisory;
  }

  classifyAndAdviseRepair(input: FailureClassifierInput & { approvedSolutionId: string }): { snapshot: FailureSnapshot; advisory: RepairAdvisory } {
    const snapshot = this.failureClassifier.classify(input);
    this.audit.recordFailureClassification(snapshot);
    const advisory = this.repairAdvisor.adviseSnapshot({ missionId: input.missionId, approvedSolutionId: input.approvedSolutionId, snapshot });
    this.audit.recordRepairAdvisory(advisory);
    return { snapshot, advisory };
  }

  completeRepair(input: { missionId: string; taskId: string; advisoryContextHash: string; failureCode: string; success: boolean; repairCount?: number }): LearningOutcome {
    this.audit.recordRepairOutcome(input);
    return this.learning.recordRepair(input);
  }

  assessRepairEligibility(input: { missionId: string; taskId: string; risk: RepairRisk; maxAttempts?: number; approvalGranted?: boolean }): RepairEligibilityDecision | undefined {
    const overview = this.readModel.getTask(input.missionId, input.taskId);
    if (!overview) return undefined;
    const decision = this.repairEligibility.evaluate({ ...input, overview });
    this.audit.recordRepairEligibility(decision);
    return decision;
  }
}
