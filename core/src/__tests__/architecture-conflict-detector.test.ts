import { ArchitectureConflictDetector } from '../services/architecture-conflict-detector';
import { Generator } from '../generator';
import { ArchitectureComposer } from '../services/architecture-composer';

describe('ArchitectureConflictDetector', () => {
  const detector = new ArchitectureConflictDetector();
  const composer = new ArchitectureComposer();

  it('should detect REST vs GraphQL conflict', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { BACKEND: 'stack.typescript.nestjs', FRONTEND: 'stack.typescript.react' },
    });
    const result = generator.generate({
      missionId: 'mission-comm',
      rawUserIdea: 'Quero uma API backend com NestJS e frontend React.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    const proposals = composition.proposals.map((p) => ({
      ...p,
      communication: p.stackKey.includes('nestjs')
        ? ['GraphQL API']
        : ['HTTP REST'],
    }));

    const conflicts = detector.detect(proposals);
    const commConflict = conflicts.find((c) => c.topic === 'communication-protocol');
    expect(commConflict).toBeDefined();
  });

  it('should detect per-service vs shared database conflict', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' },
    });
    const result = generator.generate({
      missionId: 'mission-db',
      rawUserIdea: 'Quero uma plataforma enterprise com Java backend e React frontend.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    const proposals = composition.proposals.map((p) => ({
      ...p,
      persistence:
        p.architectureStyle === 'microservices'
          ? 'Per-service database'
          : 'Single relational database',
    }));

    const conflicts = detector.detect(proposals);
    const dbConflict = conflicts.find((c) => c.topic === 'data-ownership');
    expect(dbConflict).toBeDefined();
  });
});
