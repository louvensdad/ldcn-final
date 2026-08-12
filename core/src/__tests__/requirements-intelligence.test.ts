import { RequirementsIntelligence } from '../services/requirements-intelligence';
import { IntentAnalyzer } from '../services/intent-analyzer';

describe('RequirementsIntelligence', () => {
  const analyzer = new IntentAnalyzer();
  const requirements = new RequirementsIntelligence();

  it('should build a DRAFT contract from intent', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-1',
      rawUserIdea: 'Quero uma plataforma para gerenciar tarefas com login e dashboard.',
    });

    const contract = requirements.buildContract(intent);

    expect(contract.status).toBe('DRAFT');
    expect(contract.missionId).toBe(intent.missionId);
    expect(contract.intentId).toBe(intent.id);
    expect(contract.items.length).toBeGreaterThan(0);
    expect(contract.items.some((i) => i.category === 'functional')).toBe(true);
  });

  it('should not choose stack or create teams', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-2',
      rawUserIdea: 'Quero um app mobile.',
      forbiddenDeliveryTargets: [],
    });

    const contract = requirements.buildContract(intent);
    const descriptions = contract.items.map((i) => i.description.toLowerCase()).join(' ');
    expect(descriptions).not.toContain('nestjs');
    expect(descriptions).not.toContain('react');
    expect(descriptions).not.toContain('team');
  });

  it('should approve contract', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-3',
      rawUserIdea: 'Sistema simples.',
    });

    const draft = requirements.buildContract(intent);
    const approved = requirements.approve(draft);

    expect(approved.status).toBe('APPROVED');
    expect(approved.id).toBe(draft.id);
  });
});
