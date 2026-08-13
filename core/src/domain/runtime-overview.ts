export type RuntimeExecutionStatus = 'DISPATCHED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';

export interface RuntimeTaskOverview {
  missionId: string;
  taskId: string;
  executionId?: string;
  executionStatus: RuntimeExecutionStatus;
  attemptCount: number;
  lastGateStatus?: 'PASSED' | 'FAILED' | 'BLOCKED';
  advisoryCount: number;
  outcomeCount: number;
  nextAction: 'WAIT_RUNTIME' | 'REVIEW' | 'REPAIR_ADVISORY' | 'RETRY_EXECUTION' | 'NONE';
}
