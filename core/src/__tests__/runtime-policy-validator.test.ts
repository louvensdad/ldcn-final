import { RuntimePolicyValidator } from '../services/runtime-policy-validator';

describe('RuntimePolicyValidator', () => {
  it('accepts positive safe integer limits', () => {
    expect(() => new RuntimePolicyValidator().assertValid({ maxExecutionAttempts: 3, maxRepairAttempts: 3 })).not.toThrow();
  });

  it('rejects invalid execution and repair limits', () => {
    const validator = new RuntimePolicyValidator();
    expect(() => validator.assertValid({ maxExecutionAttempts: 0, maxRepairAttempts: 3 })).toThrow('RUNTIME_EXECUTION_ATTEMPT_POLICY_INVALID');
    expect(() => validator.assertValid({ maxExecutionAttempts: 3, maxRepairAttempts: -1 })).toThrow('RUNTIME_REPAIR_ATTEMPT_POLICY_INVALID');
    expect(() => validator.assertValid({ maxExecutionAttempts: Number.POSITIVE_INFINITY, maxRepairAttempts: 3 })).toThrow('RUNTIME_EXECUTION_ATTEMPT_POLICY_INVALID');
  });
});
