import { ApprovedSolution, MissionPipelinePlan, PipelineNode } from '../domain';

export class PipelineValidator {
  validate(nodes: PipelineNode[], solution: ApprovedSolution): void {
    const keys = new Set<string>();
    const allowedStacks = new Set(solution.selectedStacks.map((s) => s.stackKey));
    const allowedTargets = new Set(solution.deliveryTargets.map((t) => t.kind));
    for (const node of nodes) {
      if (keys.has(node.key)) throw new Error(`Duplicate pipeline node: ${node.key}`);
      keys.add(node.key);
      if (node.stackKey && !allowedStacks.has(node.stackKey)) throw new Error(`Pipeline stack outside ApprovedSolution: ${node.stackKey}`);
      if (node.target && node.key !== 'integration.validation' && !allowedTargets.has(node.target as never)) throw new Error(`Pipeline target outside ApprovedSolution: ${node.target}`);
      for (const target of node.targetKinds ?? []) if (node.key !== 'integration.validation' && !allowedTargets.has(target as never)) throw new Error(`Pipeline target outside ApprovedSolution: ${target}`);
      if (!node.contractRefs.includes(solution.requirementsContractId)) throw new Error(`Pipeline node missing approved requirements contract: ${node.key}`);
      for (const dependency of node.dependsOn) if (!nodes.some((candidate) => candidate.key === dependency)) throw new Error(`Dangling pipeline dependency: ${dependency}`);
    }
    this.assertAcyclic(nodes);
  }

  validatePlan(plan: MissionPipelinePlan, solution: ApprovedSolution): void {
    this.validate(plan.nodes, solution);
    const expected = plan.nodes.flatMap((node) => node.dependsOn.map((fromNodeKey) => `${fromNodeKey}->${node.key}`)).sort();
    const actual = plan.dependencies.map((dependency) => `${dependency.fromNodeKey}->${dependency.toNodeKey}`).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Pipeline dependency graph inconsistent');
  }

  private assertAcyclic(nodes: PipelineNode[]): void {
    const byKey = new Map(nodes.map((node) => [node.key, node]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): void => {
      if (visiting.has(key)) throw new Error(`Pipeline dependency cycle detected at ${key}`);
      if (visited.has(key)) return;
      visiting.add(key);
      for (const dependency of byKey.get(key)?.dependsOn ?? []) visit(dependency);
      visiting.delete(key);
      visited.add(key);
    };
    for (const node of nodes) visit(node.key);
  }
}
