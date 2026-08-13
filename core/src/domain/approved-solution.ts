import { DeliveryTarget, SolutionTopology } from './solution-topology';
import { SelectionMode } from './stack-selection';
import { VersionedEntity } from './shared';

export interface SelectedStack {
  deliveryTargetKind: string;
  stackKey: string;
  rationale: string;
}

export interface ApprovedSolution extends VersionedEntity {
  topology: SolutionTopology;
  deliveryTargets: DeliveryTarget[];
  selectedStacks: SelectedStack[];
  selectionMode: SelectionMode;
  requirementsContractId: string;
  complexityProfile: string;
  riskProfile: string;
  approvedAt: Date;
  status: 'ACTIVE' | 'SUPERSEDED';
  contextHash: string;
}

export interface ApprovedSolutionInput {
  missionId: string;
  topology: SolutionTopology;
  selectionProposal: {
    mode: SelectionMode;
    selections: SelectedStack[];
  };
  requirementsContractId: string;
  approvedByPolicy?: boolean;
  kindsRequiringStack?: string[];
}
