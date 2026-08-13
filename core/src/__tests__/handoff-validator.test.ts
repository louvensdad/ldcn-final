import { HandoffValidator } from '../services/handoff-validator';
import { HandoffPackage } from '../domain';

const valid = (overrides: Partial<HandoffPackage> = {}): HandoffPackage => ({ id: 'h', missionId: 'm', version: 1, taskId: 't', fromTeam: 'a', toTeam: 'b', contractRefs: ['c'], artifactRefs: [], evidenceRefs: [], decisions: [], constraints: [], unresolvedDependencies: [], acceptanceCriteria: [], contextHash: 'a'.repeat(64), ...overrides });

describe('HandoffValidator', () => {
  it('rejects cross-mission and hidden reasoning handoffs', () => {
    const validator = new HandoffValidator();
    expect(() => validator.validate(valid(), 'other')).toThrow('HANDOFF_CROSS_MISSION');
    expect(() => validator.validate(valid({ decisions: ['chain-of-thought: hidden'] }), 'm')).toThrow('HANDOFF_FORBIDDEN_CONTENT');
  });
});
