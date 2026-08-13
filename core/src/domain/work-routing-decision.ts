import { VersionedEntity } from './shared';
import { ScopeExpansionProposal } from './scope-expansion';

export type RoutingSource = 'DETERMINISTIC' | 'POLICY' | 'LLM_ASSISTED' | 'HYBRID' | 'ML_ASSISTED';
export type RoutingStatus = 'ROUTED' | 'BLOCKED_CAPABILITY_GAP' | 'BLOCKED_NO_EXECUTOR' | 'BLOCKED_NO_REVIEWER' | 'ROUTING_TARGET_OUT_OF_SCOPE' | 'ROUTING_STACK_OUT_OF_SCOPE' | 'SCOPE_EXPANSION_REQUIRED';

export interface WorkRoutingDecision extends VersionedEntity {
  taskId: string;
  approvedSolutionId: string;
  jobClassificationId: string;
  selectedTeamKey?: string;
  executorAgentInstanceId?: string;
  selectedAgentInstanceIds: string[];
  reviewerCandidateIds: string[];
  selectedReviewerIds: string[];
  requiredSpecialists: string[];
  requiredCapabilityKeys: string[];
  requiredGateKeys: string[];
  routingSource: RoutingSource;
  confidence: number;
  rationale: string;
  contextHash: string;
  status: RoutingStatus;
  scopeExpansionProposal?: ScopeExpansionProposal;
}
