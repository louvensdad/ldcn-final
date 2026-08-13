import { VersionedEntity } from './shared';

export type RepairRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RepairAdvisory extends VersionedEntity {
  taskId: string;
  failureSnapshotId?: string;
  approvedSolutionId: string;
  failureCode: string;
  likelyCapabilities: string[];
  likelySpecialistRole: string;
  estimatedSuccess: number;
  risk: RepairRisk;
  rationale: string;
  status: 'ADVISORY_ONLY';
  contextHash: string;
}
