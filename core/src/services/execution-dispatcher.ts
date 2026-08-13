import { ExecutionContextSnapshot, ExecutionDispatchResult, WorkRoutingDecision } from '../domain';
import { generateId } from '../utils/id';
import { RuntimeBoundaryGuard } from './runtime-boundary-guard';

export interface ExecutionRuntimePort {
  dispatch(input: { missionId: string; taskId: string; agentInstanceId: string; context: ExecutionContextSnapshot }): { executionId: string };
  readStatus?(input: { missionId: string; taskId: string; executionId: string }): { status: 'RUNNING' | 'COMPLETED' | 'FAILED'; evidenceRefs?: string[]; durationMs?: number };
}

export interface ExecutionDispatchInput {
  missionId: string;
  decision: WorkRoutingDecision;
  context: ExecutionContextSnapshot;
  requestedTerritory?: string;
  requestedTools?: string[];
}

export interface ExecutionDispatchRepository {
  findByIdempotencyKey(key: string): ExecutionDispatchResult | undefined;
  save(key: string, result: ExecutionDispatchResult): ExecutionDispatchResult;
}

export class InMemoryExecutionDispatchStore implements ExecutionDispatchRepository {
  private results = new Map<string, ExecutionDispatchResult>();
  findByIdempotencyKey(key: string): ExecutionDispatchResult | undefined { return this.results.get(key); }
  save(key: string, result: ExecutionDispatchResult): ExecutionDispatchResult {
    const existing = this.results.get(key);
    if (existing) return existing;
    this.results.set(key, result);
    return result;
  }
}

/** Adapts validated routing to the existing runtime; it never executes work itself. */
export class ExecutionDispatcher {
  constructor(private readonly runtime: ExecutionRuntimePort, private readonly repository: ExecutionDispatchRepository = new InMemoryExecutionDispatchStore(), private readonly boundaryGuard = new RuntimeBoundaryGuard()) {}

  dispatch(input: ExecutionDispatchInput): ExecutionDispatchResult {
    const { decision, context } = input;
    if (input.missionId !== decision.missionId || input.missionId !== context.missionId) throw new Error('EXECUTION_CROSS_MISSION');
    if (decision.status !== 'ROUTED' || !decision.executorAgentInstanceId) throw new Error('EXECUTION_ROUTING_NOT_READY');
    if (context.taskId !== decision.taskId || context.approvedSolutionId !== decision.approvedSolutionId) throw new Error('EXECUTION_CONTEXT_MISMATCH');
    if (context.routingDecisionContextHash !== decision.contextHash) throw new Error('EXECUTION_CONTEXT_STALE');
    this.boundaryGuard.assertAllowed({ context, requestedTerritory: input.requestedTerritory ?? context.territory, requestedTools: input.requestedTools ?? context.allowedTools });
    const key = `${input.missionId}:${decision.taskId}:${decision.contextHash}`;
    const existing = this.repository.findByIdempotencyKey(key);
    if (existing) return { ...existing, status: 'REPLAYED' };
    const execution = this.runtime.dispatch({ missionId: input.missionId, taskId: decision.taskId, agentInstanceId: decision.executorAgentInstanceId, context });
    const result: ExecutionDispatchResult = { id: generateId(), missionId: input.missionId, version: 1, taskId: decision.taskId, routingDecisionId: decision.id, executionId: execution.executionId, status: 'DISPATCHED', contextHash: decision.contextHash };
    return this.repository.save(key, result);
  }
}
