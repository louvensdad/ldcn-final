import { RepairEligibilityPolicy } from '../services/repair-eligibility-policy';
import { RuntimeTaskOverview } from '../domain';

const overview = (overrides: Partial<RuntimeTaskOverview> = {}) => ({ missionId: 'eligibility-1', taskId: 'task-1', executionStatus: 'FAILED', attemptCount: 1, advisoryCount: 0, outcomeCount: 1, nextAction: 'REPAIR_ADVISORY', ...overrides } as RuntimeTaskOverview);

describe('RepairEligibilityPolicy', () => {
  it('allows a failed task below the attempt limit', () => {
    expect(new RepairEligibilityPolicy().evaluate({ missionId: 'eligibility-1', overview: overview(), risk: 'HIGH' }).status).toBe('ELIGIBLE');
  });

  it('blocks the attempt limit and critical repair without approval', () => {
    const policy = new RepairEligibilityPolicy();
    expect(policy.evaluate({ missionId: 'eligibility-1', overview: overview({ attemptCount: 3 }), risk: 'HIGH' }).status).toBe('BLOCKED');
    expect(policy.evaluate({ missionId: 'eligibility-1', overview: overview(), risk: 'CRITICAL' }).requiresApproval).toBe(true);
    expect(policy.evaluate({ missionId: 'eligibility-1', overview: overview(), risk: 'CRITICAL' }).status).toBe('BLOCKED');
  });
});
