import { MissionPipelinePlan, NextAction } from '../domain';

export class PipelineReadModel {
  nextActions(plan: MissionPipelinePlan): NextAction[] {
    if (plan.status !== 'APPROVED') return [];
    return plan.nodes.filter((node) => node.dependsOn.length === 0 && node.state === 'PENDING').map((node) => ({ nodeKey: node.key, type: node.type, ownerRole: node.ownerRole, stackKey: node.stackKey, targetKinds: node.targetKinds ?? (node.target ? [node.target] : []) }));
  }
}
