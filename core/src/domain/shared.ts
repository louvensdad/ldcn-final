export type InfoSource = 'USER_EXPLICIT' | 'INFERRED' | 'UNKNOWN';

export interface DecisionConfidence {
  value: number; // 0.0 to 1.0
  missingInformation: string[];
  decisionImpact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VersionedEntity {
  id: string;
  missionId: string;
  version: number;
}
