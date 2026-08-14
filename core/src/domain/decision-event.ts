import { VersionedEntity } from './shared';

export type GeneratorDecisionEventType =
  | 'INTENT_ANALYZED' | 'REQUIREMENTS_APPROVED' | 'TOPOLOGY_PROPOSED' | 'TOPOLOGY_APPROVED'
  | 'SOLUTION_PROPOSED' | 'SOLUTION_APPROVED' | 'STACK_SELECTED' | 'ARCHITECTURE_DECIDED'
  | 'TEAM_COMPOSED' | 'PIPELINE_COMPOSED' | 'JOB_CLASSIFIED' | 'JOB_ROUTED'
  | 'TEAM_SWITCHED' | 'HANDOFF_CREATED' | 'SCOPE_EXPANSION_PROPOSED'
  | 'EXECUTION_DISPATCHED' | 'EXECUTION_COMPLETED' | 'EXECUTION_FAILED' | 'REVIEW_COMPLETED' | 'GATE_EVALUATED' | 'FAILURE_CLASSIFIED' | 'REPAIR_ADVISORY_CREATED' | 'REPAIR_ELIGIBILITY_EVALUATED' | 'REPAIR_COMPLETED' | 'LEARNING_OUTCOME_RECORDED' | 'GENERATOR_STATE_CHANGED' | 'AI_EXPLANATION_GENERATED';

export interface GeneratorDecisionEvent extends VersionedEntity {
  eventType: GeneratorDecisionEventType;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, string | number | boolean | null>;
  createdAt: number;
}
