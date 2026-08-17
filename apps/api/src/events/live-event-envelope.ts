/**
 * CORE-006 — contrato canônico do EventLog / EventBus. Distinto de `FrontendEvent` (que
 * continua existindo e funcionando exatamente como antes, para os call sites já existentes de
 * `eventBus.emit()`) — `LiveEventEnvelope` é o envelope versionado e correlacionável que passa a
 * ser persistido no EventLog append-only antes de ser publicado.
 */
export interface LiveEventActor {
  type: string;
  id?: string;
}

export interface LiveEventEnvelope<T = unknown> {
  id: string;
  sequence: number;
  missionId: string;
  correlationId: string;
  causationId?: string;
  type: string;
  version: number;
  actor: LiveEventActor;
  occurredAt: string;
  payload: T;
}

/**
 * Namespaces reservados (doc CORE-006 §5) — só os tipos abaixo têm emissores reais nesta CORE.
 * CORE-015 adiciona approval.*, company.*, job.planned e mission.assembly_* porque agora possuem
 * produtores persistentes reais. Os demais namespaces continuam reservados até seus respectivos
 * comportamentos canônicos existirem.
 */
export type LiveEventType =
  | 'agent.summoned'
  | 'agent.state_changed'
  | 'agent.context_ready'
  | 'agent.analysis_completed'
  | 'agent.planning_completed'
  | 'agent.implementation_completed'
  | 'agent.selfcheck_completed'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.cancelled'
  | 'agent.llm_invocation_started'
  | 'agent.llm_invocation_completed'
  | 'agent.llm_invocation_failed'
  | 'job.execution_started'
  | 'job.execution_mode_selected'
  | 'job.cognitive_completed'
  | 'job.failed'
  | 'mission.generation_started'
  | 'mission.generation_progress'
  | 'mission.generation_failed'
  | 'mission.generation_completed'
  | 'approval.requested'
  | 'approval.decided'
  | 'mission.assembly_started'
  | 'mission.implementation_plan_ready'
  | 'company.assembling'
  | 'company.ready'
  | 'job.planned'
  | 'job.routed'
  | 'job.routing_blocked'
  | 'mission.assembly_ready'
  | 'mission.assembly_failed';
