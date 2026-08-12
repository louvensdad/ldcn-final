import { StackArchitect } from '../services/stack-architect';
import { StackRegistry } from '../registry/stack-registry';
import { Generator } from '../generator';

describe('StackArchitect', () => {
  const architect = new StackArchitect();
  const registry = new StackRegistry();

  function buildContext(idea: string) {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({ missionId: 'mission-arch', rawUserIdea: idea });
    return result;
  }

  it('should design a modular monolith for NestJS by default', () => {
    const result = buildContext('Quero uma API backend com NestJS.');
    const backend = result.approvedSolution.selectedStacks.find((s) => s.deliveryTargetKind === 'BACKEND');
    expect(backend?.stackKey).toBe('stack.typescript.nestjs');

    const proposal = architect.design({
      approvedSolution: result.approvedSolution,
      selectedStack: backend!,
      stackDefinition: registry.get(backend!.stackKey)!,
      contract: result.contract,
    });

    expect(proposal.stackKey).toBe('stack.typescript.nestjs');
    expect(proposal.architectureStyle).toBe('modular-monolith');
    expect(proposal.modules.length).toBeGreaterThan(0);
    expect(proposal.status).toBe('PROPOSED');
    expect(proposal.decisions.length).toBeGreaterThan(0);
  });

  it('should design full-stack single runtime for Next.js', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { FRONTEND: 'stack.typescript.nextjs' },
    });
    const result = generator.generate({
      missionId: 'mission-nextjs',
      rawUserIdea: 'Quero uma plataforma full-stack com Next.js.',
    });
    const fullstack = result.approvedSolution.selectedStacks.find(
      (s) => s.stackKey === 'stack.typescript.nextjs'
    );
    expect(fullstack).toBeDefined();

    const proposal = architect.design({
      approvedSolution: result.approvedSolution,
      selectedStack: fullstack!,
      stackDefinition: registry.get(fullstack!.stackKey)!,
      contract: result.contract,
    });

    expect(proposal.architectureStyle).toBe('fullstack-single-runtime');
    expect(proposal.communication.length).toBeGreaterThan(0);
  });

  it('should choose microservices when scale is required', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { BACKEND: 'stack.java.spring-boot' },
    });
    const result = generator.generate({
      missionId: 'mission-java',
      rawUserIdea: 'Quero uma plataforma enterprise escalável para milhões de usuários.',
    });
    const backend = result.approvedSolution.selectedStacks.find((s) => s.deliveryTargetKind === 'BACKEND');
    expect(backend?.stackKey).toBe('stack.java.spring-boot');

    const proposal = architect.design({
      approvedSolution: result.approvedSolution,
      selectedStack: backend!,
      stackDefinition: registry.get(backend!.stackKey)!,
      contract: result.contract,
    });

    expect(proposal.architectureStyle).toBe('microservices');
  });
});
