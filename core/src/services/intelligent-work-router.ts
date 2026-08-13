import { AgentInstance, AgentTeam, ApprovedSolution, JobClassification, WorkRoutingDecision } from '../domain';
import { generateId } from '../utils/id';
import { ScopeExpansionProposer } from './scope-expansion-proposer';
import { StackRegistry } from '../registry/stack-registry';
import { CapabilityResolver } from './capability-resolver';
import { ReviewerResolver } from './reviewer-resolver';
import { createHash } from 'crypto';

export interface IntelligentWorkRouterInput {
  missionId: string;
  taskId: string;
  classification: JobClassification;
  approvedSolution: ApprovedSolution;
  agentTeam: AgentTeam;
  registry?: StackRegistry;
}

/** Selects a minimal capable team; it does not create agents or execute work. */
export class IntelligentWorkRouter {
  private decisions = new Map<string, WorkRoutingDecision>();
  private capabilityResolver = new CapabilityResolver();
  private reviewerResolver = new ReviewerResolver();

  route(input: IntelligentWorkRouterInput): WorkRoutingDecision {
    const existing = this.decisions.get(this.key(input.missionId, input.taskId));
    const previousVersion = existing?.version ?? 0;
    const contextHash = this.contextHash(input);
    if (existing && existing.approvedSolutionId === input.approvedSolution.id && existing.jobClassificationId === input.classification.id && existing.contextHash === contextHash) return existing;
    if (existing) throw new Error('ROUTING_DECISION_STALE');
    this.assertBoundary(input);

    const targetInScope = !input.classification.deliveryTarget || input.approvedSolution.deliveryTargets.some((target) => target.kind === input.classification.deliveryTarget);
    const stackInScope = !input.classification.primaryStackKey || input.approvedSolution.selectedStacks.some((selection) => selection.stackKey === input.classification.primaryStackKey);
    const targetCandidates = this.targetCandidates(input);
    const capabilityCandidates = targetCandidates.filter((agent) => this.supportsRequiredCapabilities(agent, input.classification));
    const capabilityResolution = this.capabilityResolver.resolve(input.classification.requiredCapabilities, capabilityCandidates);
    const missing = capabilityResolution.missing;
    const executor = capabilityCandidates.find((a) => this.isExecutor(a));
    const reviewerResolution = this.reviewerResolver.resolve(targetCandidates, executor?.id);
    const reviewers = targetCandidates.filter((agent) => reviewerResolution.candidateIds.includes(agent.id));
    const status = !stackInScope
        ? 'ROUTING_STACK_OUT_OF_SCOPE'
        : input.classification.scopeExpansionRequired
          ? 'SCOPE_EXPANSION_REQUIRED'
          : !targetInScope
            ? 'ROUTING_TARGET_OUT_OF_SCOPE'
      : !executor && targetCandidates.length > 0
          ? 'BLOCKED_NO_EXECUTOR'
        : missing.length > 0
          ? 'BLOCKED_CAPABILITY_GAP'
          : !executor
            ? 'BLOCKED_NO_EXECUTOR'
        : reviewers.length === 0
          ? 'BLOCKED_NO_REVIEWER'
          : 'ROUTED';
    const scopeExpansionProposal = status === 'SCOPE_EXPANSION_REQUIRED'
      ? new ScopeExpansionProposer().propose({
          missionId: input.missionId,
          taskId: input.taskId,
          classification: input.classification,
          approvedSolution: input.approvedSolution,
          registry: input.registry ?? new StackRegistry(),
        })
      : undefined;

    const specialists = capabilityCandidates.filter((a) => !this.isExecutor(a) && !this.isReviewer(a));
    const selectedIds = status === 'ROUTED' && executor
      ? [executor.id, ...specialists.map((a) => a.id)]
      : [];
    const decision: WorkRoutingDecision = {
      id: generateId(), missionId: input.missionId, version: previousVersion + 1,
      taskId: input.taskId, approvedSolutionId: input.approvedSolution.id,
      jobClassificationId: input.classification.id,
      selectedTeamKey: executor ? this.teamKey(executor) : undefined,
      executorAgentInstanceId: status === 'ROUTED' ? executor?.id : undefined,
      selectedAgentInstanceIds: selectedIds,
      reviewerCandidateIds: reviewers.map((a) => a.id),
      selectedReviewerIds: status === 'ROUTED' && reviewerResolution.selectedReviewerId ? [reviewerResolution.selectedReviewerId] : [],
      requiredSpecialists: input.classification.requiredCapabilities.filter((key) => key !== 'backend_implementation' && key !== 'frontend_implementation'),
      requiredCapabilityKeys: input.classification.requiredCapabilities,
      requiredGateKeys: ['review', 'quality'], routingSource: 'DETERMINISTIC',
      confidence: status === 'ROUTED' ? 1 : 0,
      rationale: this.rationale(status, missing, input.classification),
      contextHash,
      status,
      scopeExpansionProposal,
    };
    this.decisions.set(this.key(input.missionId, input.taskId), decision);
    return decision;
  }

  get(missionId: string, taskId: string): WorkRoutingDecision | undefined {
    return this.decisions.get(this.key(missionId, taskId));
  }

  private assertBoundary(input: IntelligentWorkRouterInput): void {
    if (input.approvedSolution.status !== 'ACTIVE') throw new Error('Routing requires an ACTIVE ApprovedSolution');
    if (input.agentTeam.status !== 'APPROVED') throw new Error('Routing requires an approved AgentTeam');
    if (input.missionId !== input.approvedSolution.missionId || input.missionId !== input.agentTeam.missionId) throw new Error('Routing entities belong to different missions');
    if (input.classification.missionId !== input.missionId) throw new Error('Classification belongs to a different mission');
  }

  private targetCandidates(input: IntelligentWorkRouterInput): AgentInstance[] {
    const approvedStacks = new Set(input.approvedSolution.selectedStacks.map((s) => s.stackKey));
    const target = input.classification.deliveryTarget;
    const stack = input.classification.primaryStackKey;
    return input.agentTeam.instances.filter((agent) => {
      if (agent.stackKey && !approvedStacks.has(agent.stackKey)) return false;
      if (stack && agent.stackKey && agent.stackKey !== stack && !this.isIntegration(agent)) return false;
      if (target === 'EXTERNAL_INTEGRATION') return this.isIntegration(agent);
      if (target && agent.stackKey) return input.approvedSolution.selectedStacks.some((s) => s.stackKey === agent.stackKey && s.deliveryTargetKind === target);
      return true;
    });
  }

  private supportsRequiredCapabilities(agent: AgentInstance, classification: JobClassification): boolean {
    if (this.isReviewer(agent) || agent.role === 'ARCHITECT' || agent.role === 'TEST_ENGINEER') return false;
    const caps = classification.requiredCapabilities;
    if (classification.requiresIntegration && !this.isIntegration(agent)) return false;
    if (caps.includes('java') && !agent.agentKey.includes('.java.')) return false;
    if (caps.includes('angular') && !agent.agentKey.includes('.angular.')) return false;
    return true;
  }

  private isExecutor(agent: AgentInstance): boolean { return ['LEAD', 'SENIOR_DEVELOPER', 'DEVELOPER', 'INTEGRATION_ENGINEER'].includes(agent.role); }
  private isReviewer(agent: AgentInstance): boolean { return ['REVIEWER', 'INTEGRATION_REVIEWER'].includes(agent.role); }
  private isIntegration(agent: AgentInstance): boolean { return agent.role.startsWith('INTEGRATION_'); }
  private teamKey(agent: AgentInstance): string { return agent.stackKey ?? 'integration-unit'; }
  private key(missionId: string, taskId: string): string { return `${missionId}:${taskId}`; }
  private contextHash(input: IntelligentWorkRouterInput): string { return createHash('sha256').update(JSON.stringify({ missionId: input.missionId, solutionId: input.approvedSolution.id, teamId: input.agentTeam.id, classificationId: input.classification.id })).digest('hex'); }
  private rationale(status: string, missing: string[], classification: JobClassification): string {
    if (status === 'SCOPE_EXPANSION_REQUIRED') return 'O target do job nÃ£o pertence Ã  ApprovedSolution; routing interrompido.';
    if (status === 'ROUTING_STACK_OUT_OF_SCOPE') return 'A stack primÃ¡ria do job nÃ£o pertence Ã  ApprovedSolution.';
    if (status === 'BLOCKED_CAPABILITY_GAP') return `Capabilities ausentes: ${missing.join(', ')}.`;
    if (status === 'BLOCKED_NO_EXECUTOR') return 'Nenhum executor elegível disponível na Mission Team.';
    if (status === 'BLOCKED_NO_REVIEWER') return 'Nenhum reviewer independente disponÃ­vel na Mission Team.';
    return `Job ${classification.jobType} roteado para o menor conjunto capaz, com reviewer independente.`;
  }
}
