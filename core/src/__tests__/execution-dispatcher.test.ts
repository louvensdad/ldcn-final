import { ExecutionContextBuilder, ExecutionDispatcher, ExecutionRuntimePort, InMemoryExecutionDispatchStore } from '../services';
import { WorkRoutingDecision } from '../domain';

describe('ExecutionDispatcher', () => {
  it('dispatches once to the existing runtime and replays retries', () => {
    const calls: string[] = [];
    const runtime: ExecutionRuntimePort = { dispatch: ({ taskId }) => { calls.push(taskId); return { executionId: 'execution-1' }; } };
    const decision = { id: 'route-1', missionId: 'dispatch-1', version: 1, taskId: 'task-1', approvedSolutionId: 'solution-1', jobClassificationId: 'job-1', executorAgentInstanceId: 'agent-1', selectedAgentInstanceIds: ['agent-1'], reviewerCandidateIds: ['reviewer-1'], selectedReviewerIds: ['reviewer-1'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: ['BUILD_GATE'], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'matched', contextHash: 'route-hash', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'dispatch-1', missionSummary: 'summary', approvedSolutionId: 'solution-1', contractRefs: ['contract-1'], architectureDecisionRefs: [], taskId: 'task-1', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'route-hash' });
    const dispatcher = new ExecutionDispatcher(runtime);
    expect(dispatcher.dispatch({ missionId: 'dispatch-1', decision, context }).status).toBe('DISPATCHED');
    expect(dispatcher.dispatch({ missionId: 'dispatch-1', decision, context }).status).toBe('REPLAYED');
    expect(calls).toEqual(['task-1']);
  });

  it('blocks non-routed decisions', () => {
    const dispatcher = new ExecutionDispatcher({ dispatch: () => ({ executionId: 'never' }) });
    expect(() => dispatcher.dispatch({ missionId: 'dispatch-2', decision: { missionId: 'dispatch-2', status: 'BLOCKED_NO_EXECUTOR' } as WorkRoutingDecision, context: { missionId: 'dispatch-2' } as never })).toThrow('EXECUTION_ROUTING_NOT_READY');
  });

  it('supports an injected idempotency repository', () => {
    const repository = new InMemoryExecutionDispatchStore();
    const runtime: ExecutionRuntimePort = { dispatch: () => ({ executionId: 'execution-persisted' }) };
    const decision = { id: 'route-persisted', missionId: 'dispatch-3', version: 1, taskId: 'task-3', approvedSolutionId: 'solution-3', executorAgentInstanceId: 'agent-3', contextHash: 'route-hash-3', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'dispatch-3', missionSummary: 'summary', approvedSolutionId: 'solution-3', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-3', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: [], routingDecisionContextHash: 'route-hash-3' });
    new ExecutionDispatcher(runtime, repository).dispatch({ missionId: 'dispatch-3', decision, context });
    expect(repository.findByIdempotencyKey('dispatch-3:task-3:route-hash-3')?.executionId).toBe('execution-persisted');
  });

  it('blocks a runtime request outside the context boundary', () => {
    const runtime: ExecutionRuntimePort = { dispatch: () => ({ executionId: 'never' }) };
    const decision = { id: 'route-boundary', missionId: 'dispatch-4', version: 1, taskId: 'task-4', approvedSolutionId: 'solution-4', jobClassificationId: 'job-4', executorAgentInstanceId: 'agent-4', selectedAgentInstanceIds: ['agent-4'], reviewerCandidateIds: ['reviewer-4'], selectedReviewerIds: ['reviewer-4'], requiredSpecialists: [], requiredCapabilityKeys: [], requiredGateKeys: [], routingSource: 'DETERMINISTIC', confidence: 1, rationale: 'matched', contextHash: 'route-hash-4', status: 'ROUTED' } as WorkRoutingDecision;
    const context = new ExecutionContextBuilder().build({ missionId: 'dispatch-4', missionSummary: 'summary', approvedSolutionId: 'solution-4', contractRefs: [], architectureDecisionRefs: [], taskId: 'task-4', taskDescription: 'task', dependencies: [], affectedArtifacts: [], capabilityKeys: [], territory: 'backend', allowedTools: ['test'], routingDecisionContextHash: 'route-hash-4' });
    expect(() => new ExecutionDispatcher(runtime).dispatch({ missionId: 'dispatch-4', decision, context, requestedTerritory: 'frontend' })).toThrow('RUNTIME_TERRITORY_FORBIDDEN');
  });
});
