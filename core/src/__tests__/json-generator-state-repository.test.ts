import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeneratorStateMachine } from '../services/generator-state-machine';
import { JsonGeneratorStateRepository } from '../services/json-generator-state-repository';

describe('JsonGeneratorStateRepository', () => {
  it('reloads mission state and keeps versioned transitions', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ldcn-state-')), 'states.json');
    const first = new GeneratorStateMachine(new JsonGeneratorStateRepository(file));
    first.initialize('m1');
    first.transition('m1', 'INTENT_READY');
    first.transition('m1', 'REQUIREMENTS_DRAFT');

    const reloaded = new JsonGeneratorStateRepository(file);
    expect(reloaded.get('m1')).toEqual({ missionId: 'm1', state: 'REQUIREMENTS_DRAFT', version: 3 });
    expect(() => new GeneratorStateMachine(reloaded).transition('m1', 'REQUIREMENTS_APPROVED', 1)).toThrow('GENERATOR_CONTEXT_STALE');
  });
});
