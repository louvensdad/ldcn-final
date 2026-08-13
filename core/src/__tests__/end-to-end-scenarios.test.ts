import { Generator } from '../generator';

describe('Canonical end-to-end scenarios', () => {
  it('landing page does not create a backend', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'e2e-landing', rawUserIdea: 'Quero uma landing page institucional com SEO.' });
    expect(result.approvedSolution.deliveryTargets.some((target) => target.kind === 'BACKEND')).toBe(false);
    expect(result.approvedSolution.selectedStacks.some((stack) => stack.deliveryTargetKind === 'BACKEND')).toBe(false);
  });

  // Regressão do doc 34 (Guardrails de Readiness): "quero uma landing page" chegava a
  // approvedStackCount = 0, pipelineNodeCount = 0, AgentTeam.instances = [] e mesmo assim
  // status = READY_FOR_EXECUTION. Uma Executable Mission precisa produzir pelo menos um
  // DeliveryTarget, uma stack selecionada, um AgentTeam e um pipeline não-vazios.
  it('landing page is a constitutional executable mission (doc 34)', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'e2e-landing-guardrail', rawUserIdea: 'quero uma landing page' });
    expect(result.approvedSolution.deliveryTargets.some((target) => target.kind === 'FRONTEND')).toBe(true);
    expect(result.approvedSolution.selectedStacks.length).toBeGreaterThan(0);
    expect(result.agentTeam.status).toBe('APPROVED');
    expect(result.agentTeam.instances.length).toBeGreaterThan(0);
    expect(result.pipeline.status).toBe('APPROVED');
    expect(result.pipeline.nodes.length).toBeGreaterThan(0);
    expect(result.governance.allowed).toBe(true);
    expect(result.governance.errors).toHaveLength(0);
  });

  it('backend-only does not create frontend or mobile', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'e2e-backend', rawUserIdea: 'Quero uma API REST backend para expor dados.' });
    expect(result.approvedSolution.deliveryTargets.map((target) => target.kind)).not.toContain('FRONTEND');
    expect(result.approvedSolution.deliveryTargets.map((target) => target.kind)).not.toContain('MOBILE');
    expect(result.pipeline.nodes.every((node) => node.target !== 'FRONTEND' && node.target !== 'MOBILE')).toBe(true);
  });

  it('mobile-only can select Flutter', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { MOBILE: 'stack.dart.flutter' } }).generate({ missionId: 'e2e-mobile', rawUserIdea: 'Quero um aplicativo mobile Flutter.' });
    expect(result.approvedSolution.selectedStacks).toEqual(expect.arrayContaining([expect.objectContaining({ stackKey: 'stack.dart.flutter', deliveryTargetKind: 'MOBILE' })]));
  });

  it('Next.js can cover a full-stack solution', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { FRONTEND: 'stack.typescript.nextjs', BACKEND: 'stack.typescript.nextjs' } }).generate({ missionId: 'e2e-next', rawUserIdea: 'Quero uma aplicação full-stack Next.js com dashboard.' });
    expect(new Set(result.approvedSolution.selectedStacks.map((stack) => stack.stackKey))).toEqual(new Set(['stack.typescript.nextjs']));
    expect(result.agentTeam.instances.some((agent) => agent.role === 'INTEGRATION_ENGINEER')).toBe(false);
    expect(result.architectureComposition.proposals).toHaveLength(1);
    expect(result.agentTeam.instances.filter((agent) => agent.stackKey === 'stack.typescript.nextjs' && agent.role === 'ARCHITECT')).toHaveLength(1);
    expect(result.pipeline.nodes.find((node) => node.stackKey === 'stack.typescript.nextjs')?.targetKinds).toEqual(expect.arrayContaining(['BACKEND', 'FRONTEND']));
  });

  it.each([
    'Quero um blog pessoal.',
    'Quero montar meu portfólio online.',
    'Quero um site institucional para minha empresa.',
  ])('%s infers a required FRONTEND target', (rawUserIdea) => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: `e2e-frontend-${rawUserIdea.length}`, rawUserIdea });
    expect(result.approvedSolution.deliveryTargets.some((target) => target.kind === 'FRONTEND')).toBe(true);
    expect(result.pipeline.nodes.length).toBeGreaterThan(0);
  });

  it('a generic idea without concrete signals stays a legitimate empty AgentTeam (no false positive from raw idea text)', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'e2e-vague', rawUserIdea: 'Quero um app para gerenciar tarefas.', forbiddenDeliveryTargets: ['MOBILE'] });
    expect(result.approvedSolution.deliveryTargets.some((target) => target.kind === 'AI')).toBe(false);
    expect(result.approvedSolution.selectedStacks).toHaveLength(0);
    expect(result.agentTeam.instances).toHaveLength(0);
  });

  it('forbidden mobile remains outside the approved solution', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'e2e-forbidden', rawUserIdea: 'Quero um aplicativo para clientes.', forbiddenDeliveryTargets: ['MOBILE'] });
    expect(result.topology.deliveryTargets.find((target) => target.kind === 'MOBILE')?.status).toBe('FORBIDDEN_BY_SCOPE');
    expect(result.approvedSolution.selectedStacks.some((stack) => stack.deliveryTargetKind === 'MOBILE')).toBe(false);
  });
});
