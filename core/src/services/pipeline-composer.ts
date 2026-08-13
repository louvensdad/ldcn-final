import { generateId } from '../utils/id';
import {
  AgentRoleKind,
  AgentTeam,
  MissionPipelinePlan,
  PipelineNode,
  PipelineNodeType,
  ApprovedArchitectureComposition,
  ApprovedSolution,
  RequirementsContract,
} from '../domain';
import { StackRegistry } from '../registry/stack-registry';
import { PipelineValidator } from './pipeline-validator';
import { createHash } from 'crypto';

export interface PipelineComposerInput {
  approvedSolution: ApprovedSolution;
  architectureComposition: ApprovedArchitectureComposition;
  agentTeam: AgentTeam;
  contract: RequirementsContract;
  registry: StackRegistry;
}

/**
 * Builds a declarative execution plan. It never executes a node and never
 * expands the ApprovedSolution boundary.
 */
export class PipelineComposer {
  private plans = new Map<string, MissionPipelinePlan>();
  private validator = new PipelineValidator();

  compose(input: PipelineComposerInput): MissionPipelinePlan {
    this.assertInputs(input);
    const nodes: PipelineNode[] = [];
    const selectionsByStack = new Map<string, typeof input.approvedSolution.selectedStacks>();
    for (const selection of input.approvedSolution.selectedStacks) selectionsByStack.set(selection.stackKey, [...(selectionsByStack.get(selection.stackKey) ?? []), selection]);
    const uniqueSelectedStacks = [...selectionsByStack.entries()];
    const stackKeys = uniqueSelectedStacks.map(([stackKey]) => stackKey);

    for (const [stackKey, selections] of uniqueSelectedStacks) {
      const selected = selections[0];
      const stack = input.registry.get(stackKey);
      if (!stack) throw new Error(`Pipeline stack ${stackKey} not found in registry`);
      const targetKinds = selections.map((selection) => selection.deliveryTargetKind);

      const prefix = this.keyPart(stackKey);
      const generation = this.node(`${prefix}.generation`, 'GENERATION', selected.deliveryTargetKind, targetKinds, stackKey, 'LEAD', [], input, stack.runtimeSupport);
      const build = this.node(`${prefix}.build`, 'BUILD', selected.deliveryTargetKind, targetKinds, stackKey, 'DEVELOPER', [generation.key], input, stack.runtimeSupport);
      const test = this.node(`${prefix}.test`, 'TEST', selected.deliveryTargetKind, targetKinds, stackKey, 'TEST_ENGINEER', [build.key], input, stack.runtimeSupport);
      const review = this.node(`${prefix}.review`, 'REVIEW', selected.deliveryTargetKind, targetKinds, stackKey, 'REVIEWER', [test.key], input, stack.runtimeSupport);
      const gate = this.node(`${prefix}.gate`, 'GATE', selected.deliveryTargetKind, targetKinds, stackKey, 'REVIEWER', [review.key], input, stack.runtimeSupport);
      const promotion = this.node(`${prefix}.promotion`, 'PROMOTION', selected.deliveryTargetKind, targetKinds, stackKey, 'LEAD', [gate.key], input, stack.runtimeSupport);
      nodes.push(generation, build, test, review, gate, promotion);
    }

    const needsIntegration = new Set(stackKeys).size > 1 || input.approvedSolution.deliveryTargets.some((t) => t.kind === 'EXTERNAL_INTEGRATION');
    if (needsIntegration) {
      const dependencies = nodes.filter((n) => n.type === 'GATE').map((n) => n.key);
      const integration = this.node('integration.validation', 'INTEGRATION_VALIDATION', 'EXTERNAL_INTEGRATION', ['EXTERNAL_INTEGRATION'], undefined, 'INTEGRATION_REVIEWER', dependencies, input, true);
      nodes.push(integration);
      for (const promotion of nodes.filter((n) => n.type === 'PROMOTION')) {
        promotion.dependsOn = [...promotion.dependsOn, integration.key];
      }
    }

    this.validator.validate(nodes, input.approvedSolution);

    const existing = this.plans.get(input.approvedSolution.missionId);
    const dependencies = nodes.flatMap((node) => node.dependsOn.map((fromNodeKey) => ({ fromNodeKey, toNodeKey: node.key })));
    if (existing && existing.status !== 'SUPERSEDED' && existing.approvedSolutionId === input.approvedSolution.id && existing.architectureCompositionId === input.architectureComposition.id && existing.agentTeamId === input.agentTeam.id && JSON.stringify(existing.dependencies) === JSON.stringify(dependencies)) return existing;
    if (existing) this.plans.set(input.approvedSolution.missionId, { ...existing, status: 'SUPERSEDED' });
    const blocked = nodes.some((n) => n.state === 'BLOCKED_UNSUPPORTED_RUNTIME');
    const plan: MissionPipelinePlan = {
      id: generateId(),
      missionId: input.approvedSolution.missionId,
      version: existing ? existing.version + 1 : 1,
      approvedSolutionId: input.approvedSolution.id,
      architectureCompositionId: input.architectureComposition.id,
      agentTeamId: input.agentTeam.id,
      nodes,
      dependencies,
      contextHash: createHash('sha256').update(JSON.stringify({ approvedSolutionId: input.approvedSolution.id, architectureCompositionId: input.architectureComposition.id, agentTeamId: input.agentTeam.id, contractId: input.contract.id })).digest('hex'),
      status: blocked ? 'BLOCKED_UNSUPPORTED_RUNTIME' : 'APPROVED',
    };
    this.validator.validatePlan(plan, input.approvedSolution);
    this.plans.set(plan.missionId, plan);
    return plan;
  }

  getActive(missionId: string): MissionPipelinePlan | undefined {
    const plan = this.plans.get(missionId);
    return plan && plan.status !== 'SUPERSEDED' ? plan : undefined;
  }

  private node(
    key: string,
    type: PipelineNodeType,
    target: string,
    targetKinds: string[],
    stackKey: string | undefined,
    ownerRole: AgentRoleKind,
    dependsOn: string[],
    input: PipelineComposerInput,
    runtimeSupport: boolean,
  ): PipelineNode {
    return {
      id: generateId(), key, type, target, targetKinds, stackKey, required: true, dependsOn,
      ownerRole,
      contractRefs: [input.contract.id],
      gateRefs: type === 'GATE' ? [`${this.keyPart(stackKey ?? 'integration')}.quality`] : [],
      state: runtimeSupport ? 'PENDING' : 'BLOCKED_UNSUPPORTED_RUNTIME',
      blockedReason: runtimeSupport ? undefined : `Runtime sem suporte para ${stackKey ?? target}`,
    };
  }

  private assertInputs(input: PipelineComposerInput): void {
    if (input.approvedSolution.status !== 'ACTIVE') throw new Error('Pipeline requires an ACTIVE ApprovedSolution');
    if (input.architectureComposition.status !== 'APPROVED') throw new Error('Pipeline requires approved architectures');
    if (input.agentTeam.status !== 'APPROVED') throw new Error('Pipeline requires an approved AgentTeam');
    if (input.contract.status !== 'APPROVED') throw new Error('Pipeline requires an approved RequirementsContract');
    const approved = new Set(input.approvedSolution.selectedStacks.map((s) => s.stackKey));
    if (input.architectureComposition.proposals.some((p) => !approved.has(p.stackKey))) throw new Error('Architecture contains a stack outside ApprovedSolution');
  }

  private keyPart(value: string): string {
    return value.replace(/^stack\./, '').replace(/[^a-zA-Z0-9]+/g, '-');
  }
}
