import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonExecutionDispatchStore } from '../services/json-execution-dispatch-store';

describe('JsonExecutionDispatchStore', () => {
  it('persists dispatches and returns the original result on replay', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ldcn-dispatches-')), 'dispatches.json');
    const store = new JsonExecutionDispatchStore(file);
    const result = { id: 'd1', missionId: 'm1', version: 1, taskId: 't1', routingDecisionId: 'r1', executionId: 'e1', status: 'DISPATCHED' as const, contextHash: 'h1' };
    expect(store.save('m1:t1:h1', result)).toEqual(result);
    expect(store.save('m1:t1:h1', { ...result, executionId: 'e2' })).toEqual(result);
    expect(new JsonExecutionDispatchStore(file).findByIdempotencyKey('m1:t1:h1')).toEqual(result);
  });
});
