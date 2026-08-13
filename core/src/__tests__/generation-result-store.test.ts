import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Generator } from '../generator';
import { JsonGenerationResultStore } from '../services/generation-result-store';

describe('JsonGenerationResultStore', () => {
  it('persists a result and its command fingerprint', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ldcn-results-')), 'results.json');
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'm1', rawUserIdea: 'Quero uma API.' });
    const store = new JsonGenerationResultStore(file);
    store.save('m1', { fingerprint: 'fp1', result });
    const loaded = new JsonGenerationResultStore(file).get('m1');
    expect(loaded?.fingerprint).toBe('fp1');
    expect(loaded?.result.approvedSolution.id).toBe(result.approvedSolution.id);
    expect(loaded?.result.approvedSolution.approvedAt).toEqual(result.approvedSolution.approvedAt);
  });
});
