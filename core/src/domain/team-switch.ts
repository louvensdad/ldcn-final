import { VersionedEntity } from './shared';

export type HandoffType =
  | 'ARCHITECTURE_TO_DELIVERY' | 'BACKEND_TO_FRONTEND' | 'BACKEND_TO_MOBILE'
  | 'STACK_TO_INTEGRATION' | 'INTEGRATION_TO_STACK' | 'DELIVERY_TO_REVIEW'
  | 'REVIEW_TO_REWORK' | 'QA_TO_REWORK' | 'SECURITY_TO_REWORK'
  | 'REPAIR_TO_REVIEW' | 'EXTERNAL_INTEGRATION_HANDOFF';

export type TeamSwitchStatus = 'SWITCH_REQUIRED' | 'NO_SWITCH' | 'BLOCKED_SCOPE';

export interface HandoffPackage extends VersionedEntity {
  taskId: string;
  fromTeam: string;
  toTeam: string;
  contractRefs: string[];
  artifactRefs: string[];
  evidenceRefs: string[];
  decisions: string[];
  constraints: string[];
  unresolvedDependencies: string[];
  acceptanceCriteria: string[];
  contextHash: string;
}

export interface TeamSwitchDecision extends VersionedEntity {
  sourceTaskId: string;
  sourceTeamKey: string;
  targetTeamKey: string;
  reason: string;
  handoffType: HandoffType;
  requiredContracts: string[];
  requiredArtifacts: string[];
  requiredEvidence: string[];
  contextSnapshotId: string;
  status: TeamSwitchStatus;
  handoff: HandoffPackage;
}
