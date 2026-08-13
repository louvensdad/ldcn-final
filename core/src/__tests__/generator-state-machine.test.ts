import { GeneratorStateMachine } from '../services/generator-state-machine';

describe('GeneratorStateMachine', () => {
  it('allows the canonical planning path and rejects invalid jumps', () => {
    const machine = new GeneratorStateMachine();
    machine.initialize('state-1');
    machine.transition('state-1', 'INTENT_READY');
    machine.transition('state-1', 'REQUIREMENTS_DRAFT');
    expect(() => machine.transition('state-1', 'ACTIVE')).toThrow('Invalid generator transition');
  });

  it('replans with a reason and rejects stale versions', () => {
    const machine = new GeneratorStateMachine();
    machine.initialize('state-2');
    machine.transition('state-2', 'INTENT_READY');
    machine.transition('state-2', 'REQUIREMENTS_DRAFT');
    machine.transition('state-2', 'REQUIREMENTS_APPROVED');
    machine.transition('state-2', 'TOPOLOGY_PROPOSED');
    machine.transition('state-2', 'TOPOLOGY_APPROVED');
    machine.transition('state-2', 'SOLUTION_PLANNING');
    machine.transition('state-2', 'SOLUTION_PROPOSED');
    machine.transition('state-2', 'SOLUTION_APPROVED');
    const current = machine.replan('state-2', 'SECURITY_REQUIREMENT_CHANGED');
    expect(current.state).toBe('SOLUTION_PLANNING');
    expect(current.lastReason).toBe('SECURITY_REQUIREMENT_CHANGED');
    expect(() => machine.transition('state-2', 'SOLUTION_PROPOSED', current.version - 1)).toThrow('GENERATOR_CONTEXT_STALE');
  });

  it('is retry-safe for an already applied transition', () => {
    const machine = new GeneratorStateMachine();
    const first = machine.transition('state-retry', 'INTENT_READY');
    const retry = machine.transition('state-retry', 'INTENT_READY');
    expect(retry).toBe(first);
    expect(retry.version).toBe(2);
  });

  it('is retry-safe for the same replan request', () => {
    const machine = new GeneratorStateMachine();
    for (const state of ['INTENT_READY', 'REQUIREMENTS_DRAFT', 'REQUIREMENTS_APPROVED', 'TOPOLOGY_PROPOSED', 'TOPOLOGY_APPROVED', 'SOLUTION_PLANNING', 'SOLUTION_PROPOSED', 'SOLUTION_APPROVED'] as const) machine.transition('state-replan-retry', state);
    const first = machine.replan('state-replan-retry', 'REQUIREMENTS_CHANGED');
    const retry = machine.replan('state-replan-retry', 'REQUIREMENTS_CHANGED');
    expect(retry).toBe(first);
  });
});
