import { VersionedEntity } from './shared';

export type OutcomeType = 'STACK_SELECTION' | 'TEAM_COMPOSITION' | 'JOB_ROUTING' | 'AGENT_EXECUTION' | 'BUILD' | 'TEST' | 'REVIEW' | 'GATE' | 'REPAIR' | 'PROMOTION' | 'USER_DECISION' | 'COST';

export interface LearningOutcome extends VersionedEntity {
  taskId?: string;
  outcomeType: OutcomeType;
  featureSchemaVersion: string;
  features: Record<string, string | number | boolean | null>;
  decision: string;
  result: string;
  success: boolean;
  qualityScore?: number;
  cost?: number;
  durationMs?: number;
  repairCount?: number;
  buildPassed?: boolean;
  testsPassed?: boolean;
  userAccepted?: boolean;
}

export interface JobComplexityPrediction { value: 'LOW' | 'MEDIUM' | 'HIGH'; confidence: number; predictorVersion: string; }
export interface JobRiskPrediction { value: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; confidence: number; predictorVersion: string; }
