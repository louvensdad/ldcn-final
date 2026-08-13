import { VersionedEntity } from './shared';

export type ExecutionDispatchStatus = 'DISPATCHED' | 'REPLAYED';

export interface ExecutionDispatchResult extends VersionedEntity {
  taskId: string;
  routingDecisionId: string;
  executionId: string;
  status: ExecutionDispatchStatus;
  contextHash: string;
}
