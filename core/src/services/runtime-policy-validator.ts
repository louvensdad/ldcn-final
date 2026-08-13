import { RuntimePolicyConfig } from '../domain';

export class RuntimePolicyValidator {
  assertValid(policy: RuntimePolicyConfig): void {
    if (!Number.isSafeInteger(policy.maxExecutionAttempts) || policy.maxExecutionAttempts <= 0) throw new Error('RUNTIME_EXECUTION_ATTEMPT_POLICY_INVALID');
    if (!Number.isSafeInteger(policy.maxRepairAttempts) || policy.maxRepairAttempts <= 0) throw new Error('RUNTIME_REPAIR_ATTEMPT_POLICY_INVALID');
  }
}
