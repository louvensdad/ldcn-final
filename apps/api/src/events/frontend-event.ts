/** Espelha doc 36 §68 (FrontendEvent<T>). workspaceId/projectId omitidos: ainda não existem no sistema. */
export type FrontendEventType =
  | 'operation.started'
  | 'operation.completed'
  | 'operation.failed'
  | 'mission.state.changed'
  | 'mission.solution.approved'
  | 'team.composed'
  | 'pipeline.updated'
  // MISSÃO "Tempo real (SSE) + UI de agentes ativos" — cada um destes é emitido no mesmo
  // instante real em que o pipeline (GenerationEngineService/ArchitectureReviewService) já muda
  // de fase de verdade — nenhum evento é sintético ou fabricado só para a UI parecer viva.
  | 'architecture_review.started'
  | 'architecture_review.completed'
  | 'generation.scaffolded'
  | 'generation.job.started'
  | 'generation.job.completed'
  | 'generation.build.started'
  | 'generation.build.completed'
  | 'generation.test.started'
  | 'generation.test.completed'
  | 'generation.security.started'
  | 'generation.security.completed'
  | 'generation.runtime.started'
  | 'generation.runtime.completed'
  | 'generation.ready'
  | 'generation.failed';

export interface FrontendEvent<T = unknown> {
  id: string;
  type: FrontendEventType;
  occurredAt: string;
  missionId?: string;
  taskId?: string;
  operationId?: string;
  payload: T;
}
