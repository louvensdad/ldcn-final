import { RequirementsIntelligence } from '../services/requirements-intelligence';
import { IntentAnalyzer } from '../services/intent-analyzer';
import { TopologyResolver } from '../services/topology-resolver';
import { SolutionPlanner } from '../services/solution-planner';

describe('SolutionPlanner', () => {
  const analyzer = new IntentAnalyzer();
  const requirements = new RequirementsIntelligence();
  const resolver = new TopologyResolver();
  const planner = new SolutionPlanner();

  it('should propose a solution without selecting stacks', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-1',
      rawUserIdea: 'Quero uma plataforma com API backend e dashboard frontend.',
    });
    const contract = requirements.approve(requirements.buildContract(intent));
    const topology = resolver.approve(resolver.resolve({ contract, forbiddenTargets: [] }));

    const proposal = planner.plan({ contract, topology });

    expect(proposal.recommendedSolution).toBeTruthy();
    expect(proposal.rationale).toBeTruthy();
    expect(proposal.tradeoffs.length).toBeGreaterThan(0);
  });

  it('should throw if contract is not approved', () => {
    const intent = analyzer.analyze({ missionId: 'mission-2', rawUserIdea: 'Sistema.' });
    const draft = requirements.buildContract(intent);
    const topology = resolver.approve(resolver.resolve({ contract: requirements.approve(draft), forbiddenTargets: [] }));

    expect(() => planner.plan({ contract: draft, topology })).toThrow(
      'APPROVED before solution planning'
    );
  });
});
