import { VersionedEntity } from './shared';

export interface SolutionProposal extends VersionedEntity {
  requirementsContractId: string;
  topologyId: string;
  recommendedSolution: string;
  alternatives: string[];
  rationale: string;
  tradeoffs: string[];
  risks: string[];
  assumptions: string[];
}
