export interface OperationalMissionOverview {
  missionId: string;
  runtimeTaskCount: number;
  runningTaskCount: number;
  failedTaskCount: number;
  reviewPendingCount: number;
  repairPendingCount: number;
  retryPendingCount: number;
}
