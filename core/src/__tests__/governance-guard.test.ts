import { Generator } from '../generator';
import { GovernanceGuard } from '../services/governance-guard';

describe('GovernanceGuard', () => {
  it('allows a complete current generator context', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'gov-ready', rawUserIdea: 'Quero uma plataforma com login e dashboard.' });
    const check = new GovernanceGuard().check({ intent: result.intent, contract: result.contract, topology: result.topology, solution: result.approvedSolution, architecture: result.architectureComposition, team: result.agentTeam, pipeline: result.pipeline });
    expect(check.allowed).toBe(true);
    expect(check.errors).toEqual([]);
    expect(check.contextHash).toHaveLength(64);
    expect(result.architectureComposition.contextHash).toHaveLength(64);
    expect(result.agentTeam.contextHash).toHaveLength(64);
    expect(result.topology.contextHash).toHaveLength(64);
    expect(result.contract.contextHash).toHaveLength(64);
    expect(result.intent.contextHash).toHaveLength(64);
  });

  it('blocks a stale pipeline context', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'gov-stale', rawUserIdea: 'Quero uma plataforma com login.' });
    const stale = { ...result.pipeline, approvedSolutionId: 'old-solution-id' };
    const check = new GovernanceGuard().check({ intent: result.intent, contract: result.contract, topology: result.topology, solution: result.approvedSolution, architecture: result.architectureComposition, team: result.agentTeam, pipeline: stale });
    expect(check.allowed).toBe(false);
    expect(check.errors).toContain('GENERATOR_CONTEXT_STALE');
  });

  it('blocks content tampering even when entity links remain unchanged', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'gov-hash-stale', rawUserIdea: 'Quero uma plataforma com login.' });
    const tamperedTeam = { ...result.agentTeam, instances: [...result.agentTeam.instances, { id: 'tampered', agentKey: 'unknown', role: 'DEVELOPER' as const, reason: 'tampered' }] };
    const check = new GovernanceGuard().check({ intent: result.intent, contract: result.contract, topology: result.topology, solution: result.approvedSolution, architecture: result.architectureComposition, team: tamperedTeam, pipeline: result.pipeline });
    expect(check.errors).toContain('GENERATOR_CONTEXT_STALE');
  });
});
