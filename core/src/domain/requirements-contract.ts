import { InfoSource, VersionedEntity } from './shared';

export type RequirementCategory =
  | 'functional'
  | 'nonFunctional'
  | 'businessRules'
  | 'actors'
  | 'roles'
  | 'permissions'
  | 'integrations'
  | 'data'
  | 'security'
  | 'compliance'
  | 'scale'
  | 'availability'
  | 'latency'
  | 'SEO'
  | 'offline'
  | 'accessibility'
  | 'localization'
  | 'timeToMarket'
  | 'budget'
  | 'deploymentConstraints';

export type Priority = 'must' | 'should' | 'could' | 'wont';

export interface RequirementItem {
  id: string;
  category: RequirementCategory;
  description: string;
  source: InfoSource;
  priority: Priority;
  acceptanceCriteria: string[];
  ambiguity: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RequirementsContract extends VersionedEntity {
  intentId: string;
  items: RequirementItem[];
  status: 'DRAFT' | 'APPROVED';
  contextHash: string;
}
