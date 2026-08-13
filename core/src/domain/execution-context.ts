import { VersionedEntity } from './shared';

export interface ExecutionContextInput {
  missionId: string;
  missionSummary: string;
  approvedSolutionId: string;
  contractRefs: string[];
  architectureDecisionRefs: string[];
  taskId: string;
  taskDescription: string;
  dependencies: string[];
  affectedArtifacts: string[];
  capabilityKeys: string[];
  territory: string;
  allowedTools: string[];
  previousEvidence?: string[];
  handoffPackageId?: string;
  routingDecisionContextHash?: string;
}

export interface ExecutionContextSnapshot extends VersionedEntity {
  taskId: string;
  approvedSolutionId: string;
  missionSummary: string;
  contractRefs: string[];
  architectureDecisionRefs: string[];
  taskDescription: string;
  dependencies: string[];
  affectedArtifacts: string[];
  capabilityKeys: string[];
  territory: string;
  allowedTools: string[];
  previousEvidence: string[];
  handoffPackageId?: string;
  routingDecisionContextHash?: string;
  contextHash: string;
}
