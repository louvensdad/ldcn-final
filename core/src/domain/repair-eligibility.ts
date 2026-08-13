import { VersionedEntity } from './shared';

export interface RepairEligibilityDecision extends VersionedEntity {
  taskId: string;
  attemptCount: number;
  maxAttempts: number;
  status: 'ELIGIBLE' | 'BLOCKED';
  reason: string;
  requiresApproval: boolean;
}
