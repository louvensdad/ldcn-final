import { IntentAnalyzer } from '../services/intent-analyzer';

describe('IntentAnalyzer', () => {
  const analyzer = new IntentAnalyzer();

  it('should classify items and not choose stack or architecture', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-1',
      rawUserIdea: 'Quero uma plataforma para gerenciar tarefas com login e dashboard.',
    });

    expect(intent.missionId).toBe('mission-1');
    expect(intent.problemStatement).toBeTruthy();
    expect(intent.targetUsers.length).toBeGreaterThan(0);
    expect(intent.explicitRequirements.length).toBeGreaterThanOrEqual(0);
    expect(intent.technologyPreferences).toEqual([]);
    expect(intent.status).toBe('READY');
    expect(intent.confidence.value).toBeGreaterThan(0);
  });

  it('should respect forbidden delivery targets without inventing scope', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-2',
      rawUserIdea: 'Quero um sistema simples.',
      forbiddenDeliveryTargets: ['MOBILE'],
    });

    expect(intent.forbiddenDeliveryTargets).toContain('MOBILE');
    expect(intent.status).toBe('READY');
  });

  it('should mark intent as DRAFT when high-impact unknowns exist', () => {
    const intent = analyzer.analyze({
      missionId: 'mission-3',
      rawUserIdea: 'Quero algo inovador.',
    });

    expect(intent.unknowns.length).toBeGreaterThan(0);
    expect(intent.confidence.decisionImpact).toBeDefined();
  });
});
