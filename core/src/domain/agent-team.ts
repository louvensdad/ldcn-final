import { VersionedEntity } from './shared';

export type AgentRoleKind =
  | 'ARCHITECT'
  | 'LEAD'
  | 'SENIOR_DEVELOPER'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'TEST_ENGINEER'
  | 'FRAMEWORK_SPECIALIST'
  | 'DATA_SPECIALIST'
  | 'SECURITY_SPECIALIST'
  | 'RUNTIME_SPECIALIST'
  | 'PERFORMANCE_SPECIALIST'
  | 'INTEGRATION_ARCHITECT'
  | 'INTEGRATION_ENGINEER'
  | 'INTEGRATION_REVIEWER'
  | 'INTEGRATION_TEST_ENGINEER';

/**
 * A single agent seat within the Mission Team.
 * `stackKey` is undefined for cross-stack roles (Integration Unit).
 * `reason` is mandatory: doc 10 rule 8 — "registrar motivo de cada AgentInstance".
 */
export interface AgentInstance {
  id: string;
  agentKey: string;
  role: AgentRoleKind;
  stackKey?: string;
  reason: string;
}

export interface TeamCompositionDecision {
  id: string;
  scope: string;
  problem: string;
  selectedOption: string;
  rationale: string;
  rulesApplied: string[];
  decidedBy: string;
}

export interface AgentTeam extends VersionedEntity {
  approvedSolutionId: string;
  architectureCompositionId: string;
  complexityProfile: string;
  riskProfile: string;
  instances: AgentInstance[];
  decisions: TeamCompositionDecision[];
  status: 'PROPOSED' | 'APPROVED';
}

export interface AgentTeamCompositionInput {
  missionId: string;
  approvedSolutionId: string;
  architectureCompositionId: string;
  complexityProfile: string;
  riskProfile: string;
  instances: AgentInstance[];
  decisions: TeamCompositionDecision[];
}
