import { VersionedEntity } from './shared';

export type FailureCategory = 'BUILD' | 'TEST' | 'SECURITY' | 'INTEGRATION' | 'RUNTIME' | 'UNKNOWN';

export interface FailureSnapshot extends VersionedEntity {
  taskId: string;
  executionId: string;
  category: FailureCategory;
  failureCode: string;
  summary: string;
  evidenceRefs: string[];
  affectedStack?: string;
  failedGateKey?: string;
  contextHash: string;
}
