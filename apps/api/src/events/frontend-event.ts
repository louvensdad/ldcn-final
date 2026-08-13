/** Espelha doc 36 §68 (FrontendEvent<T>). workspaceId/projectId omitidos: ainda não existem no sistema. */
export type FrontendEventType =
  | 'operation.started'
  | 'operation.completed'
  | 'operation.failed'
  | 'mission.state.changed'
  | 'mission.solution.approved'
  | 'team.composed'
  | 'pipeline.updated';

export interface FrontendEvent<T = unknown> {
  id: string;
  type: FrontendEventType;
  occurredAt: string;
  missionId?: string;
  taskId?: string;
  operationId?: string;
  payload: T;
}
