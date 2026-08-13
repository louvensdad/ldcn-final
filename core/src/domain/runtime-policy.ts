export interface RuntimePolicyConfig {
  maxExecutionAttempts: number;
  maxRepairAttempts: number;
}

export const DEFAULT_RUNTIME_POLICY: RuntimePolicyConfig = {
  maxExecutionAttempts: 3,
  maxRepairAttempts: 3,
};
