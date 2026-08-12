import { DeliveryTargetKind } from './solution-topology';
import { VersionedEntity } from './shared';

export type SelectionMode = 'AUTO' | 'GUIDED' | 'FIXED';

export interface StackCandidateEvaluation {
  stackKey: string;
  fitScore: number;
  requirementsCoverage: string[];
  strengths: string[];
  tradeoffs: string[];
  risks: string[];
  rejectedBecause: string[];
  constraintsSatisfied: string[];
  runtimeSupport: boolean;
}

export interface TargetStackSelection {
  deliveryTargetKind: DeliveryTargetKind;
  candidates: StackCandidateEvaluation[];
  selectedStackKey?: string;
  rationale: string;
}

export interface StackSelectionProposal extends VersionedEntity {
  mode: SelectionMode;
  selections: TargetStackSelection[];
}
