import { Generator } from '../generator';
import { JobClassifier } from '../services/job-classifier';
import { IntelligentWorkRouter } from '../services/intelligent-work-router';

describe('IntelligentWorkRouter', () => {
  it('routes a simple Java job to a Java executor and independent reviewer', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot', FRONTEND: 'stack.typescript.react' } }).generate({ missionId: 'route-java', rawUserIdea: 'Quero backend Java e frontend React.' });
    const classification = new JobClassifier().classify({ missionId: 'route-java', taskId: 'job-1', description: 'Implementar endpoint backend Java', stackKey: 'stack.java.spring-boot' }, result.approvedSolution);
    const decision = new IntelligentWorkRouter().route({ missionId: 'route-java', taskId: 'job-1', classification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam });
    expect(decision.status).toBe('ROUTED');
    expect(decision.selectedTeamKey).toBe('stack.java.spring-boot');
    expect(decision.executorAgentInstanceId).toBeTruthy();
    expect(decision.selectedReviewerIds).not.toContain(decision.executorAgentInstanceId);
    expect(decision.contextHash).toHaveLength(64);
  });

  it('blocks an out-of-scope mobile job', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({ missionId: 'route-scope', rawUserIdea: 'Quero backend Java.' });
    const classification = new JobClassifier().classify({ missionId: 'route-scope', taskId: 'job-2', description: 'Criar aplicativo mobile Flutter' }, result.approvedSolution);
    const decision = new IntelligentWorkRouter().route({ missionId: 'route-scope', taskId: 'job-2', classification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam });
    expect(decision.status).toBe('SCOPE_EXPANSION_REQUIRED');
    expect(decision.selectedAgentInstanceIds).toEqual([]);
    expect(decision.scopeExpansionProposal?.requestedDeliveryTarget).toBe('MOBILE');
    expect(decision.scopeExpansionProposal?.recommendedStacks).toContain('stack.dart.flutter');
  });

  it('is idempotent for the same mission and task', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({ missionId: 'route-idempotent', rawUserIdea: 'Quero backend Java.' });
    const classification = new JobClassifier().classify({ missionId: 'route-idempotent', taskId: 'job-3', description: 'Implementar endpoint backend Java', stackKey: 'stack.java.spring-boot' }, result.approvedSolution);
    const router = new IntelligentWorkRouter();
    const input = { missionId: 'route-idempotent', taskId: 'job-3', classification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam };
    expect(router.route(input)).toBe(router.route(input));
  });

  it('distinguishes missing executor from capability gap', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({ missionId: 'route-no-executor', rawUserIdea: 'Quero backend Java.' });
    const classification = new JobClassifier().classify({ missionId: 'route-no-executor', taskId: 'job-4', description: 'Implementar endpoint backend Java', stackKey: 'stack.java.spring-boot' }, result.approvedSolution);
    const reviewerOnlyTeam = { ...result.agentTeam, instances: [{ id: 'reviewer-only', agentKey: 'backend.java.reviewer', role: 'REVIEWER' as const, stackKey: 'stack.java.spring-boot', reason: 'test' }] };
    const decision = new IntelligentWorkRouter().route({ missionId: 'route-no-executor', taskId: 'job-4', classification, approvedSolution: result.approvedSolution, agentTeam: reviewerOnlyTeam });
    expect(decision.status).toBe('BLOCKED_NO_EXECUTOR');
  });

  it('reports an unauthorized stack independently from capability gaps', () => {
    const result = new Generator({ mode: 'AUTO' }).generate({ missionId: 'route-stack-scope', rawUserIdea: 'Quero backend Java.' });
    const classification = new JobClassifier().classify({ missionId: 'route-stack-scope', taskId: 'job-5', description: 'Implementar endpoint backend', stackKey: 'stack.dart.flutter' }, result.approvedSolution);
    const decision = new IntelligentWorkRouter().route({ missionId: 'route-stack-scope', taskId: 'job-5', classification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam });
    expect(decision.status).toBe('ROUTING_STACK_OUT_OF_SCOPE');
  });

  it('rejects a stale reroute for the same task', () => {
    const result = new Generator({ mode: 'FIXED', autoApprove: true, fixedSelections: { BACKEND: 'stack.java.spring-boot' } }).generate({ missionId: 'route-stale', rawUserIdea: 'Quero backend Java.' });
    const classifier = new JobClassifier();
    const router = new IntelligentWorkRouter();
    const firstClassification = classifier.classify({ missionId: 'route-stale', taskId: 'job-6', description: 'Implementar endpoint backend Java', stackKey: 'stack.java.spring-boot' }, result.approvedSolution);
    router.route({ missionId: 'route-stale', taskId: 'job-6', classification: firstClassification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam });
    const changedClassification = { ...firstClassification, id: 'new-classification' };
    expect(() => router.route({ missionId: 'route-stale', taskId: 'job-6', classification: changedClassification, approvedSolution: result.approvedSolution, agentTeam: result.agentTeam })).toThrow('ROUTING_DECISION_STALE');
  });
});
