import { AgentTeam, ApprovedArchitectureComposition, ApprovedSolution, GovernanceCheck, MissionPipelinePlan, ProjectIntent, RequirementsContract, SolutionTopology } from '../domain';
import { createHash } from 'crypto';

export interface GovernanceInput {
  intent: ProjectIntent;
  contract: RequirementsContract;
  topology: SolutionTopology;
  solution: ApprovedSolution;
  architecture: ApprovedArchitectureComposition;
  team: AgentTeam;
  pipeline: MissionPipelinePlan;
}

/** Final deterministic boundary check before execution can start. */
export class GovernanceGuard {
  check(input: GovernanceInput): GovernanceCheck {
    const errors = [] as GovernanceCheck['errors'];
    const intentHash = createHash('sha256').update(JSON.stringify({ missionId: input.intent.missionId, rawUserIdea: input.intent.rawUserIdea, constraints: input.intent.explicitConstraints.map((constraint) => constraint.value), technologyPreferences: input.intent.technologyPreferences, forbiddenDeliveryTargets: input.intent.forbiddenDeliveryTargets })).digest('hex');
    if (input.intent.contextHash !== intentHash) errors.push('GENERATOR_CONTEXT_STALE');
    if (input.intent.status !== 'READY') errors.push('GENERATOR_INTENT_NOT_READY');
    if (input.contract.status !== 'APPROVED') errors.push('GENERATOR_REQUIREMENTS_NOT_APPROVED');
    const contractHash = createHash('sha256').update(JSON.stringify({ intentId: input.contract.intentId, items: input.contract.items.map((item) => [item.category, item.description, item.priority]) })).digest('hex');
    if (input.contract.contextHash !== contractHash) errors.push('GENERATOR_CONTEXT_STALE');
    if (input.topology.status !== 'APPROVED') errors.push('GENERATOR_TOPOLOGY_NOT_APPROVED');
    if (input.solution.status !== 'ACTIVE') errors.push('GENERATOR_SOLUTION_NOT_APPROVED');
    if (input.architecture.status !== 'APPROVED') errors.push('GENERATOR_ARCHITECTURE_NOT_APPROVED');
    if (input.team.status !== 'APPROVED') errors.push('GENERATOR_TEAM_NOT_READY');
    if (input.pipeline.status !== 'APPROVED') errors.push('GENERATOR_PIPELINE_NOT_READY');
    if (input.contract.missionId !== input.solution.missionId || input.solution.missionId !== input.pipeline.missionId) errors.push('GENERATOR_CONTEXT_STALE');
    if (input.pipeline.approvedSolutionId !== input.solution.id || input.pipeline.architectureCompositionId !== input.architecture.id || input.pipeline.agentTeamId !== input.team.id) errors.push('GENERATOR_CONTEXT_STALE');
    const solutionHash = createHash('sha256').update(JSON.stringify({ topologyId: input.solution.topology.id, requirementsContractId: input.solution.requirementsContractId, selections: input.solution.selectedStacks.map((selection) => [selection.deliveryTargetKind, selection.stackKey]) })).digest('hex');
    if (input.solution.contextHash !== solutionHash) errors.push('GENERATOR_CONTEXT_STALE');
    const topologyHash = createHash('sha256').update(JSON.stringify({ contractId: input.topology.requirementsContractId, deliveryTargets: input.topology.deliveryTargets.map((target) => [target.kind, target.required, target.status]) })).digest('hex');
    if (input.topology.contextHash !== topologyHash) errors.push('GENERATOR_CONTEXT_STALE');
    const architectureHash = createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.solution.id, proposals: input.architecture.proposals.map((proposal) => proposal.id), conflicts: input.architecture.conflicts.map((conflict) => conflict.id) })).digest('hex');
    const teamHash = createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.solution.id, architectureCompositionId: input.architecture.id, instances: input.team.instances.map((instance) => [instance.agentKey, instance.role, instance.stackKey]) })).digest('hex');
    const pipelineHash = createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.solution.id, architectureCompositionId: input.architecture.id, agentTeamId: input.team.id, contractId: input.contract.id })).digest('hex');
    if (input.architecture.contextHash !== architectureHash || input.team.contextHash !== teamHash || input.pipeline.contextHash !== pipelineHash) errors.push('GENERATOR_CONTEXT_STALE');
    const contextHash = createHash('sha256').update(JSON.stringify({ contract: input.contract.id, solution: input.solution.id, architecture: input.architecture.id, team: input.team.id, pipeline: input.pipeline.id })).digest('hex');
    return { allowed: errors.length === 0, errors, contextHash };
  }

  assertReady(input: GovernanceInput): void {
    const result = this.check(input);
    if (!result.allowed) throw new Error(result.errors.join(', '));
  }
}
