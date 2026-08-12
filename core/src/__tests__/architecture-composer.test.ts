import { ArchitectureComposer } from '../services/architecture-composer';
import { Generator } from '../generator';

describe('ArchitectureComposer', () => {
  const composer = new ArchitectureComposer();

  it('should compose proposals for all selected stacks', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-compose',
      rawUserIdea: 'Quero uma plataforma com API NestJS e dashboard React.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    expect(composition.proposals.length).toBe(
      result.approvedSolution.selectedStacks.length
    );
    expect(composition.approvedSolutionId).toBe(result.approvedSolution.id);
    expect(composition.status).toBe('APPROVED');
  });

  it('should detect conflicts when mixing microservices and monoliths', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' },
    });
    const result = generator.generate({
      missionId: 'mission-conflict',
      rawUserIdea: 'Quero uma plataforma enterprise escalável com Java backend e React frontend.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    const styleConflict = composition.conflicts.find((c) => c.topic === 'architecture-style');
    expect(styleConflict).toBeDefined();
    expect(styleConflict?.severity).toBe('HIGH');
  });
});
