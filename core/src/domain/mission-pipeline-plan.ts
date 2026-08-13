import { AgentRoleKind } from './agent-team';
import { VersionedEntity } from './shared';

export type PipelineNodeType =
  | 'GENERATION'
  | 'BUILD'
  | 'TEST'
  | 'REVIEW'
  | 'GATE'
  | 'INTEGRATION_VALIDATION'
  | 'PROMOTION';

export type PipelineNodeState = 'PENDING' | 'BLOCKED_UNSUPPORTED_RUNTIME';

export interface PipelineNode {
  id: string;
  key: string;
  type: PipelineNodeType;
  target?: string;
  targetKinds?: string[];
  stackKey?: string;
  required: boolean;
  dependsOn: string[];
  ownerRole: AgentRoleKind;
  contractRefs: string[];
  gateRefs: string[];
  state: PipelineNodeState;
  blockedReason?: string;
}

export interface PipelineDependency {
  fromNodeKey: string;
  toNodeKey: string;
}

export interface MissionPipelinePlan extends VersionedEntity {
  approvedSolutionId: string;
  architectureCompositionId: string;
  agentTeamId: string;
  nodes: PipelineNode[];
  dependencies: PipelineDependency[];
  contextHash: string;
  status: 'APPROVED' | 'BLOCKED_UNSUPPORTED_RUNTIME' | 'SUPERSEDED';
}

export interface MissionPipelinePlanInput {
  missionId: string;
  approvedSolutionId: string;
  architectureCompositionId: string;
  agentTeamId: string;
  nodes: PipelineNode[];
}
