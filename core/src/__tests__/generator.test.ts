import { Generator } from '../generator';

describe('Generator', () => {
  it('should run the full flow from idea to approved solution', () => {
    const generator = new Generator({ mode: 'AUTO' });

    const result = generator.generate({
      missionId: 'mission-e2e',
      rawUserIdea: 'Quero uma plataforma para gerenciar tarefas com login e dashboard.',
    });

    expect(result.intent.status).toBe('READY');
    expect(result.contract.status).toBe('APPROVED');
    expect(result.topology.status).toBe('APPROVED');
    expect(result.proposal.recommendedSolution).toBeTruthy();
    expect(result.selection.selections.length).toBeGreaterThan(0);
    expect(result.approvedSolution.status).toBe('ACTIVE');
    expect(result.approvedSolution.selectedStacks.length).toBeGreaterThan(0);
    expect(result.architectureComposition.status).toBe('APPROVED');
    expect(result.architectureComposition.proposals.length).toBe(
      result.approvedSolution.selectedStacks.length
    );
  });

  it('should respect forbidden delivery targets end-to-end', () => {
    const generator = new Generator({ mode: 'AUTO' });

    const result = generator.generate({
      missionId: 'mission-forbidden',
      rawUserIdea: 'Quero um app para gerenciar tarefas.',
      forbiddenDeliveryTargets: ['MOBILE'],
    });

    const mobileTarget = result.topology.deliveryTargets.find((t) => t.kind === 'MOBILE');
    expect(mobileTarget?.status).toBe('FORBIDDEN_BY_SCOPE');
  });
});
