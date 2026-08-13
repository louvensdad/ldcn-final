import { AgentRoleKind } from './agent-team';
import { PipelineNodeType } from './mission-pipeline-plan';

export interface NextAction {
  nodeKey: string;
  type: PipelineNodeType;
  ownerRole: AgentRoleKind;
  stackKey?: string;
  targetKinds: string[];
}
