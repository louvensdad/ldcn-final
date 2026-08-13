import { FailureCategory, RepairAdvisory, RepairEligibilityDecision, RepairRisk } from './index';

export interface RepairOverview {
  missionId: string;
  taskId: string;
  failureSnapshotId?: string;
  failureCategory?: FailureCategory;
  failureCode?: string;
  risk?: RepairRisk;
  advisory?: RepairAdvisory;
  eligibility?: RepairEligibilityDecision;
  repairCompleted?: boolean;
  nextAction: 'CLASSIFY_FAILURE' | 'REVIEW_ADVISORY' | 'APPROVE_REPAIR' | 'START_REPAIR' | 'RETRY_EXECUTION' | 'NONE';
}
