import { ArchitectureValidator } from '../services/architecture-validator';
import { Generator } from '../generator';
import { ArchitectureComposer } from '../services/architecture-composer';

describe('ArchitectureValidator', () => {
  const validator = new ArchitectureValidator();
  const composer = new ArchitectureComposer();

  it('should approve composition without critical conflicts', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-validate',
      rawUserIdea: 'Quero uma API REST com NestJS.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    const approved = validator.validateAndApprove({
      missionId: composition.missionId,
      approvedSolutionId: composition.approvedSolutionId,
      proposals: composition.proposals,
      conflicts: composition.conflicts,
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.version).toBe(1);
    expect(approved.proposals.every((p) => p.status === 'APPROVED')).toBe(true);
  });

  it('should block composition with critical conflicts', () => {
    expect(() =>
      validator.validateAndApprove({
        missionId: 'mission-blocked',
        approvedSolutionId: 'solution-1',
        proposals: [],
        conflicts: [
          {
            id: 'conflict-1',
            severity: 'CRITICAL',
            topic: 'data-ownership',
            description: 'Critical conflict',
            involvedStacks: ['stack.a', 'stack.b'],
          },
        ],
      })
    ).toThrow('blocked by 1 critical conflict');
  });

  it('should make duplicate compositions idempotent', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-version',
      rawUserIdea: 'Quero uma API REST com NestJS.',
    });

    const composition = composer.compose({
      approvedSolution: result.approvedSolution,
      contract: result.contract,
      registry: (generator as any).registry,
    });

    const input = {
      missionId: composition.missionId,
      approvedSolutionId: composition.approvedSolutionId,
      proposals: composition.proposals,
      conflicts: composition.conflicts,
    };

    const first = validator.validateAndApprove(input);
    const second = validator.validateAndApprove(input);

    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(second.id).toBe(first.id);
  });
});
