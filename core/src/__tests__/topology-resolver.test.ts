import { RequirementsIntelligence } from '../services/requirements-intelligence';
import { IntentAnalyzer } from '../services/intent-analyzer';
import { TopologyResolver } from '../services/topology-resolver';

describe('TopologyResolver', () => {
  const analyzer = new IntentAnalyzer();
  const requirements = new RequirementsIntelligence();
  const resolver = new TopologyResolver();

  function approveAndResolve(idea: string, forbidden: any[] = []) {
    const intent = analyzer.analyze({ missionId: 'mission-1', rawUserIdea: idea, forbiddenDeliveryTargets: forbidden });
    const draft = requirements.buildContract(intent);
    const contract = requirements.approve(draft);
    return resolver.resolve({ contract, forbiddenTargets: intent.forbiddenDeliveryTargets });
  }

  it('should forbid mobile when explicitly forbidden', () => {
    const topology = approveAndResolve('Quero um app.', ['MOBILE']);

    const mobile = topology.deliveryTargets.find((t) => t.kind === 'MOBILE');
    expect(mobile?.status).toBe('FORBIDDEN_BY_SCOPE');
    expect(mobile?.required).toBe(false);
  });

  it('should infer backend from API requirement', () => {
    const topology = approveAndResolve('Quero uma API REST para expor dados.');

    const backend = topology.deliveryTargets.find((t) => t.kind === 'BACKEND');
    expect(backend?.required).toBe(true);
    expect(backend?.source).toBe('REQUIREMENTS_INFERRED');
  });

  it('should not materialize recommendations without approval', () => {
    const topology = approveAndResolve('Quero um sistema simples.');

    const nonRequired = topology.deliveryTargets.filter((t) => !t.required);
    expect(nonRequired.length).toBeGreaterThan(0);
    for (const target of nonRequired) {
      expect(target.status).toBe('PROPOSED');
    }
  });

  it('should infer frontend from a landing page idea (doc 34 regression)', () => {
    const topology = approveAndResolve('quero uma landing page');

    const frontend = topology.deliveryTargets.find((t) => t.kind === 'FRONTEND');
    expect(frontend?.required).toBe(true);
    expect(frontend?.source).toBe('REQUIREMENTS_INFERRED');
  });

  it('should not infer AI from unrelated words that merely contain "ia" as a substring', () => {
    const topology = approveAndResolve('Quero um app para gerenciar tarefas.', ['MOBILE']);

    const ai = topology.deliveryTargets.find((t) => t.kind === 'AI');
    expect(ai?.required).toBe(false);
  });

  it('should reject resolution with unapproved contract', () => {
    const intent = analyzer.analyze({ missionId: 'mission-2', rawUserIdea: 'Sistema.' });
    const draft = requirements.buildContract(intent);

    expect(() => resolver.resolve({ contract: draft, forbiddenTargets: [] })).toThrow(
      'APPROVED before topology resolution'
    );
  });
});
