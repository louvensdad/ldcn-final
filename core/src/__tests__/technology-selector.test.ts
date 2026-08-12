import { StackRegistry } from '../registry/stack-registry';
import { RequirementsIntelligence } from '../services/requirements-intelligence';
import { IntentAnalyzer } from '../services/intent-analyzer';
import { TopologyResolver } from '../services/topology-resolver';
import { TechnologySelector } from '../services/technology-selector';

describe('TechnologySelector', () => {
  const analyzer = new IntentAnalyzer();
  const requirements = new RequirementsIntelligence();
  const resolver = new TopologyResolver();
  const selector = new TechnologySelector();
  const registry = new StackRegistry();

  function prepare(idea: string) {
    const intent = analyzer.analyze({ missionId: 'mission-1', rawUserIdea: idea });
    const contract = requirements.approve(requirements.buildContract(intent));
    const topology = resolver.approve(resolver.resolve({ contract, forbiddenTargets: [] }));
    return { contract, topology };
  }

  it('should select top stack in AUTO mode', () => {
    const { contract, topology } = prepare('Quero uma API REST para expor dados.');

    const selection = selector.select({ contract, topology, registry, mode: 'AUTO' });

    expect(selection.mode).toBe('AUTO');
    expect(selection.selections.length).toBeGreaterThan(0);
    expect(selection.selections[0].selectedStackKey).toBeDefined();
    expect(selection.selections[0].candidates[0].fitScore).toBeGreaterThan(0);
  });

  it('should not select in GUIDED mode', () => {
    const { contract, topology } = prepare('Quero uma API REST.');

    const selection = selector.select({ contract, topology, registry, mode: 'GUIDED' });

    expect(selection.mode).toBe('GUIDED');
    expect(selection.selections.every((s) => !s.selectedStackKey)).toBe(true);
  });

  it('should respect fixed selections in FIXED mode', () => {
    const { contract, topology } = prepare('Quero uma API REST.');

    const selection = selector.select({
      contract,
      topology,
      registry,
      mode: 'FIXED',
      fixedSelections: { BACKEND: 'stack.java.spring-boot' },
    });

    const backendSelection = selection.selections.find((s) => s.deliveryTargetKind === 'BACKEND');
    expect(backendSelection?.selectedStackKey).toBe('stack.java.spring-boot');
  });
});
