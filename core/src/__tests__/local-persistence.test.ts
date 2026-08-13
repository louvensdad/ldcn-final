import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalGenerator } from '../services/local-persistence';

describe('local persistence composition', () => {
  it('reuses durable command state across service instances', () => {
    const directory = join(mkdtempSync(join(tmpdir(), 'ldcn-local-')), 'data');
    const first = createLocalGenerator(directory);
    const result = first.generate({ missionId: 'm-local', rawUserIdea: 'Quero uma API REST com login.' });
    expect(result.approvedSolution.missionId).toBe('m-local');

    const second = createLocalGenerator(directory);
    expect(second.getEvents('m-local').length).toBeGreaterThan(0);
    expect(second.getState('m-local')?.state).toBe('READY_FOR_EXECUTION');
    const replay = second.generate({ missionId: 'm-local', rawUserIdea: 'Quero uma API REST com login.' });
    expect(replay.approvedSolution.id).toBe(result.approvedSolution.id);
    expect(replay.approvedSolution.approvedAt).toEqual(result.approvedSolution.approvedAt);
    expect(second.getEvents('m-local').some((event) => event.eventType === 'SOLUTION_APPROVED')).toBe(true);
  });
});
