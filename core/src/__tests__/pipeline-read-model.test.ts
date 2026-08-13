import { Generator } from '../generator';
import { PipelineReadModel } from '../services/pipeline-read-model';

describe('PipelineReadModel', () => {
  it('returns generation nodes as next actions without executing them', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'next-action-1', rawUserIdea: 'Quero uma API backend.' });
    const actions = new PipelineReadModel().nextActions(result.pipeline);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.type === 'GENERATION')).toBe(true);
  });
});
