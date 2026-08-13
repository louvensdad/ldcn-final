import { ReplanningService } from '../services/replanning-service';
import { GeneratorStateMachine } from '../services/generator-state-machine';

describe('ReplanningService', () => {
  it('requires an approved planning boundary before replanning', () => {
    const service = new ReplanningService();
    expect(() => service.replan({ missionId: 'replan-1', reason: 'REQUIREMENTS_CHANGED' })).toThrow('Cannot replan from INTENT_PENDING');
  });

  it('replans with an explicit reason and expected version', () => {
    const machine = new GeneratorStateMachine();
    const service = new ReplanningService(machine);
    machine.initialize('replan-2');
    for (const state of ['INTENT_READY', 'REQUIREMENTS_DRAFT', 'REQUIREMENTS_APPROVED', 'TOPOLOGY_PROPOSED', 'TOPOLOGY_APPROVED', 'SOLUTION_PLANNING', 'SOLUTION_PROPOSED', 'SOLUTION_APPROVED'] as const) machine.transition('replan-2', state);
    const current = service.getState('replan-2')!;
    const replanned = service.replan({ missionId: 'replan-2', reason: 'INTEGRATION_CHANGED', expectedVersion: current.version });
    expect(replanned.state).toBe('SOLUTION_PLANNING');
    expect(replanned.lastReason).toBe('INTEGRATION_CHANGED');
  });
});
