import { VersionedEntity } from './shared';

export type DeliveryTargetKind =
  | 'BACKEND'
  | 'FRONTEND'
  | 'MOBILE'
  | 'DATA'
  | 'AI'
  | 'EXTERNAL_INTEGRATION';

export type TargetSource = 'USER_EXPLICIT' | 'REQUIREMENTS_INFERRED' | 'ARCHITECTURE_RECOMMENDED';

export type TargetStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'FORBIDDEN_BY_SCOPE';

export interface DeliveryTarget {
  kind: DeliveryTargetKind;
  required: boolean;
  source: TargetSource;
  rationale: string;
  status: TargetStatus;
}

export interface SolutionTopology extends VersionedEntity {
  requirementsContractId: string;
  deliveryTargets: DeliveryTarget[];
  status: 'PROPOSED' | 'APPROVED';
  contextHash: string;
}
