import { GeneratorStateMachine } from '../services/generator-state-machine';
import { InMemoryGeneratorStateRepository } from '../services/generator-state-repository';

describe('GeneratorStateRepository', () => {
  it('allows a state machine to be reconstructed over the same repository', () => {
    const repository = new InMemoryGeneratorStateRepository();
    const first = new GeneratorStateMachine(repository);
    first.initialize('persisted-state');
    first.transition('persisted-state', 'INTENT_READY');
    const second = new GeneratorStateMachine(repository);
    expect(second.get('persisted-state')?.state).toBe('INTENT_READY');
    expect(second.get('persisted-state')?.version).toBe(2);
  });
});
