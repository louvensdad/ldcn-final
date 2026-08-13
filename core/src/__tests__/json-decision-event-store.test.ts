import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonDecisionEventStore } from '../services/json-decision-event-store';

describe('JsonDecisionEventStore', () => {
  it('persists, reloads and preserves append-only invariants', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ldcn-events-')), 'events.json');
    const first = new JsonDecisionEventStore(file);
    const event = first.append({ missionId: 'm1', eventType: 'INTENT_ANALYZED', aggregateType: 'ProjectIntent', aggregateId: 'i1', idempotencyKey: 'k1', payload: { token: 'secret', ok: true } });
    expect(event.payload).toEqual({ ok: true });
    expect(first.append({ missionId: 'm1', eventType: 'INTENT_ANALYZED', aggregateType: 'ProjectIntent', aggregateId: 'i1', idempotencyKey: 'k1' })).toEqual(event);

    const reloaded = new JsonDecisionEventStore(file);
    expect(reloaded.list('m1')).toEqual([event]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(1);
    expect(() => reloaded.append({ missionId: 'm1', eventType: 'SOLUTION_APPROVED', aggregateType: 'Solution', aggregateId: 's1', idempotencyKey: 'k2', expectedVersion: 0 })).toThrow('GENERATOR_CONTEXT_STALE');
  });
});
