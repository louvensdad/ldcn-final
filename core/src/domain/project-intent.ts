import { DecisionConfidence, InfoSource, VersionedEntity } from './shared';
import { DeliveryTargetKind } from './solution-topology';

export interface UnknownItem {
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ClassifiedItem {
  value: string;
  source: InfoSource;
}

export interface ProjectIntent extends VersionedEntity {
  rawUserIdea: string;
  problemStatement: string;
  targetUsers: ClassifiedItem[];
  businessGoals: ClassifiedItem[];
  explicitRequirements: ClassifiedItem[];
  explicitConstraints: ClassifiedItem[];
  inferredNeeds: ClassifiedItem[];
  unknowns: UnknownItem[];
  technologyPreferences: string[];
  forbiddenDeliveryTargets: DeliveryTargetKind[];
  confidence: DecisionConfidence;
  status: 'DRAFT' | 'READY';
}

export interface IntentInput {
  missionId: string;
  rawUserIdea: string;
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: DeliveryTargetKind[];
  constraints?: string[];
}
