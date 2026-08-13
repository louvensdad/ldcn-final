import { Generator } from '../generator';
import { JobClassifier } from '../services/job-classifier';
import { TeamSwitchResolver } from '../services/team-switch-resolver';

describe('TeamSwitchResolver', () => {
  it('routes a Java to Angular switch through the Integration Unit', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' } }).generate({ missionId: 'switch-cross-stack', rawUserIdea: 'Quero backend Java e frontend React.' });
    const classification = new JobClassifier().classify({ missionId: 'switch-cross-stack', taskId: 'task-1', description: 'Integrar backend Java com frontend React' }, result.approvedSolution);
    const decision = new TeamSwitchResolver().resolve({ missionId: 'switch-cross-stack', taskId: 'task-1', sourceTeamKey: 'stack.java.spring-boot', targetTeamKey: 'stack.typescript.react', handoffType: 'BACKEND_TO_FRONTEND', classification, approvedSolution: result.approvedSolution, contractRefs: [result.contract.id], artifactRefs: ['api-contract'], evidenceRefs: ['build-1'] });
    expect(decision.status).toBe('SWITCH_REQUIRED');
    expect(decision.targetTeamKey).toBe('integration-unit');
    expect(decision.handoff.contextHash).toHaveLength(64);
    expect(decision.handoff.artifactRefs).toEqual(['api-contract']);
  });

  it('blocks a switch to an unauthorized team', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'switch-scope', rawUserIdea: 'Quero backend Java.' });
    const classification = new JobClassifier().classify({ missionId: 'switch-scope', taskId: 'task-2', description: 'Criar aplicativo mobile' }, result.approvedSolution);
    const decision = new TeamSwitchResolver().resolve({ missionId: 'switch-scope', taskId: 'task-2', sourceTeamKey: 'stack.java.spring-boot', targetTeamKey: 'stack.mobile.flutter', handoffType: 'BACKEND_TO_MOBILE', classification, approvedSolution: result.approvedSolution, contractRefs: [result.contract.id] });
    expect(decision.status).toBe('BLOCKED_SCOPE');
  });

  it('does not switch when ownership remains in the same team', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'switch-same-team', rawUserIdea: 'Quero uma API backend Java.' });
    const teamKey = result.approvedSolution.selectedStacks[0].stackKey;
    const classification = new JobClassifier().classify({ missionId: 'switch-same-team', taskId: 'task-3', description: 'Continuar implementação backend' }, result.approvedSolution);
    const decision = new TeamSwitchResolver().resolve({ missionId: 'switch-same-team', taskId: 'task-3', sourceTeamKey: teamKey, targetTeamKey: teamKey, handoffType: 'DELIVERY_TO_REVIEW', classification, approvedSolution: result.approvedSolution, contractRefs: [result.contract.id] });
    expect(decision.status).toBe('NO_SWITCH');
  });

  it('rejects a changed context for the same switch', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' } }).generate({ missionId: 'switch-stale', rawUserIdea: 'Quero backend Java e frontend React.' });
    const classification = new JobClassifier().classify({ missionId: 'switch-stale', taskId: 'task-4', description: 'Integrar backend Java com frontend React' }, result.approvedSolution);
    const resolver = new TeamSwitchResolver();
    const base = { missionId: 'switch-stale', taskId: 'task-4', sourceTeamKey: 'stack.java.spring-boot', targetTeamKey: 'stack.typescript.react', handoffType: 'BACKEND_TO_FRONTEND' as const, classification, approvedSolution: result.approvedSolution, contractRefs: [result.contract.id], artifactRefs: ['api-v1'] };
    resolver.resolve(base);
    expect(() => resolver.resolve({ ...base, artifactRefs: ['api-v2'] })).toThrow('TEAM_SWITCH_CONTEXT_STALE');
  });
});
