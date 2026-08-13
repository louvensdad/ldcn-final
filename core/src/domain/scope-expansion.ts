import { DeliveryTargetKind } from './solution-topology';
import { VersionedEntity } from './shared';

export interface ScopeExpansionProposal extends VersionedEntity {
  sourceTaskId: string;
  requestedDeliveryTarget: DeliveryTargetKind;
  recommendedStacks: string[];
  reason: string;
  requirementsImpact: string[];
  architectureImpact: string[];
  teamImpact: string[];
  pipelineImpact: string[];
  costImpact: 'LOW' | 'MEDIUM' | 'HIGH';
  riskImpact: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresApproval: true;
  status: 'PROPOSED';
  contextHash: string;
}
