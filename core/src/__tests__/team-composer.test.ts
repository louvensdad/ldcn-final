import { Generator } from '../generator';
import { TeamValidator } from '../services/team-validator';

describe('TeamComposer + TeamValidator (doc 10 - TeamComposer V2)', () => {
  it('LOW tier: composição mínima suficiente, sem reviewer nem Integration Unit', () => {
    const generator = new Generator({
      mode: 'FIXED',
      autoApprove: true,
      fixedSelections: { BACKEND: 'stack.typescript.nestjs' },
    });
    const result = generator.generate({
      missionId: 'mission-team-low',
      rawUserIdea: 'Quero um sistema de tarefas.',
    });

    expect(result.approvedSolution.complexityProfile).toBe('LOW');
    expect(result.approvedSolution.selectedStacks).toHaveLength(1);

    const { agentTeam } = result;
    expect(agentTeam.status).toBe('APPROVED');

    const roles = agentTeam.instances.map((i) => i.role);
    expect(roles).toEqual(
      expect.arrayContaining(['ARCHITECT', 'LEAD', 'TEST_ENGINEER'])
    );
    expect(roles).not.toContain('REVIEWER');
    expect(roles).not.toContain('DEVELOPER');
    expect(roles.some((r) => r.startsWith('INTEGRATION_'))).toBe(false);

    // Rule 8: todo AgentInstance carrega motivo.
    for (const instance of agentTeam.instances) {
      expect(instance.reason.length).toBeGreaterThan(0);
    }
  });

  it('MEDIUM tier: inclui Reviewer distinto do Developer', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-team-medium',
      rawUserIdea: 'Quero uma API backend com NestJS.',
    });

    expect(result.approvedSolution.complexityProfile).toBe('MEDIUM');

    const nestjsInstances = result.agentTeam.instances.filter(
      (i) => i.stackKey === 'stack.typescript.nestjs'
    );
    const reviewer = nestjsInstances.find((i) => i.role === 'REVIEWER');
    const developer = nestjsInstances.find((i) => i.role === 'DEVELOPER');
    expect(reviewer).toBeDefined();
    expect(developer).toBeDefined();
    expect(reviewer!.agentKey).not.toBe(developer!.agentKey);
  });

  it('HIGH tier: especialistas condicionais, Senior Developer, múltiplos Test Engineers e Integration Unit', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-team-high',
      rawUserIdea: 'Quero uma plataforma com API NestJS e dashboard React.',
    });

    expect(result.approvedSolution.complexityProfile).toBe('HIGH');
    expect(result.approvedSolution.selectedStacks.length).toBeGreaterThan(1);

    const backendInstances = result.agentTeam.instances.filter(
      (i) => i.stackKey === 'stack.typescript.nestjs'
    );
    const roleCounts = backendInstances.reduce<Record<string, number>>((acc, i) => {
      acc[i.role] = (acc[i.role] ?? 0) + 1;
      return acc;
    }, {});

    expect(roleCounts['SENIOR_DEVELOPER']).toBe(1);
    expect(roleCounts['DEVELOPER']).toBe(2);
    expect(roleCounts['TEST_ENGINEER']).toBe(2);
    expect(roleCounts['DATA_SPECIALIST']).toBe(1);
    expect(roleCounts['RUNTIME_SPECIALIST']).toBe(1);

    const integrationInstances = result.agentTeam.instances.filter((i) =>
      i.role.startsWith('INTEGRATION_')
    );
    expect(integrationInstances.length).toBeGreaterThan(0);
    expect(integrationInstances.every((i) => i.stackKey === undefined)).toBe(true);

    expect(result.agentTeam.decisions.length).toBeGreaterThan(0);
    for (const decision of result.agentTeam.decisions) {
      expect(decision.rulesApplied.length).toBeGreaterThan(0);
    }
  });

  it('rejeita um Reviewer que também atua como executor da mesma stack', () => {
    const validator = new TeamValidator();

    expect(() =>
      validator.validateAndApprove({
        missionId: 'mission-invalid-reviewer',
        approvedSolutionId: 'sol-1',
        architectureCompositionId: 'comp-1',
        complexityProfile: 'MEDIUM',
        riskProfile: 'LOW',
        instances: [
          {
            id: '1',
            agentKey: 'backend.nestjs.lead',
            role: 'LEAD',
            stackKey: 'stack.typescript.nestjs',
            reason: 'lead',
          },
          {
            id: '2',
            // Mesmo agentKey do Lead: viola a regra "Reviewer != executor".
            agentKey: 'backend.nestjs.lead',
            role: 'REVIEWER',
            stackKey: 'stack.typescript.nestjs',
            reason: 'reviewer inválido',
          },
        ],
        decisions: [],
      })
    ).toThrow(/Reviewer inválido/);
  });

  it('preserva uma AgentTeam vazia como estado válido quando nenhuma stack foi aprovada', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const result = generator.generate({
      missionId: 'mission-team-empty',
      rawUserIdea: 'Quero um app para gerenciar tarefas.',
      forbiddenDeliveryTargets: ['MOBILE'],
    });

    expect(result.approvedSolution.selectedStacks).toHaveLength(0);
    expect(result.agentTeam.status).toBe('APPROVED');
    expect(result.agentTeam.instances).toHaveLength(0);
  });
});
