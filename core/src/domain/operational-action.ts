export interface OperationalAction {
  missionId: string;
  taskId: string;
  action: 'WAIT_RUNTIME' | 'REVIEW' | 'REPAIR_ADVISORY' | 'RETRY_EXECUTION' | 'START_REPAIR' | 'APPROVE_REPAIR';
  source: 'RUNTIME' | 'REPAIR';
}
