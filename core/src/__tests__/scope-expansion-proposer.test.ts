import { Generator } from '../generator';
import { JobClassifier } from '../services/job-classifier';
import { ScopeExpansionProposer } from '../services/scope-expansion-proposer';
import { StackRegistry } from '../registry/stack-registry';

describe('ScopeExpansionProposer', () => {
  it('proposes mobile expansion without mutating the approved solution', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'scope-proposal', rawUserIdea: 'Quero uma API backend.' });
    const before = JSON.stringify(result.approvedSolution);
    const classification = new JobClassifier().classify({ missionId: 'scope-proposal', taskId: 'task-mobile', description: 'Criar aplicativo mobile Flutter' }, result.approvedSolution);
    const proposer = new ScopeExpansionProposer();
    const input = { missionId: 'scope-proposal', taskId: 'task-mobile', classification, approvedSolution: result.approvedSolution, registry: new StackRegistry() };
    const proposal = proposer.propose(input);
    expect(proposer.propose(input)).toBe(proposal);
    expect(proposal?.requestedDeliveryTarget).toBe('MOBILE');
    expect(proposal?.recommendedStacks.length).toBeGreaterThan(0);
    expect(proposal?.requiresApproval).toBe(true);
    expect(proposal?.contextHash).toHaveLength(64);
    expect(JSON.stringify(result.approvedSolution)).toBe(before);
  });

  it('returns no proposal when the job is already inside scope', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'scope-none', rawUserIdea: 'Quero uma API backend.' });
    const classification = new JobClassifier().classify({ missionId: 'scope-none', taskId: 'task-backend', description: 'Implementar endpoint backend' }, result.approvedSolution);
    expect(new ScopeExpansionProposer().propose({ missionId: 'scope-none', taskId: 'task-backend', classification, approvedSolution: result.approvedSolution, registry: new StackRegistry() })).toBeUndefined();
  });
});
