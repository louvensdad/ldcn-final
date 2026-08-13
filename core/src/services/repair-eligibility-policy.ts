import { DEFAULT_RUNTIME_POLICY, RepairEligibilityDecision, RepairRisk, RuntimeTaskOverview } from '../domain';
import { generateId } from '../utils/id';

export interface RepairEligibilityInput {
  missionId: string;
  overview: RuntimeTaskOverview;
  risk: RepairRisk;
  maxAttempts?: number;
  approvalGranted?: boolean;
}

export class RepairEligibilityPolicy {
  evaluate(input: RepairEligibilityInput): RepairEligibilityDecision {
    const maxAttempts = input.maxAttempts ?? DEFAULT_RUNTIME_POLICY.maxRepairAttempts;
    const requiresApproval = input.risk === 'CRITICAL';
    const status = input.overview.executionStatus === 'FAILED' && input.overview.attemptCount < maxAttempts && (!requiresApproval || input.approvalGranted === true) ? 'ELIGIBLE' : 'BLOCKED';
    const reason = input.overview.executionStatus !== 'FAILED'
      ? 'Repair requires a failed execution.'
      : input.overview.attemptCount >= maxAttempts
        ? `Maximum repair attempts reached: ${maxAttempts}.`
        : requiresApproval && !input.approvalGranted
          ? 'Critical repair requires explicit approval.'
          : 'Repair is eligible under the current policy.';
    return { id: generateId(), missionId: input.missionId, version: 1, taskId: input.overview.taskId, attemptCount: input.overview.attemptCount, maxAttempts, status, reason, requiresApproval };
  }
}
