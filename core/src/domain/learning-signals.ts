export interface LearningSignals {
  sampleCount: number;
  successRate: number;
  repairRate: number;
  averageCost?: number;
  averageDurationMs?: number;
  userAcceptanceRate?: number;
  buildPassRate?: number;
  testPassRate?: number;
}
