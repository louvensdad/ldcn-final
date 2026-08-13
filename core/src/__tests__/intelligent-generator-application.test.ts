import { IntelligentGeneratorCommandService, IntelligentGeneratorQueryService } from '../services/intelligent-generator-application';
import { InMemoryDecisionEventStore } from '../services/decision-event-store';

describe('IntelligentGenerator application services', () => {
  it('is retry-safe and records append-only stage events', () => {
    const service = new IntelligentGeneratorCommandService();
    const input = { missionId: 'application-1', rawUserIdea: 'Quero uma plataforma com login e dashboard.' };
    const first = service.generate(input);
    const retry = service.generate(input);
    expect(retry).toBe(first);
    expect(service.getEvents('application-1').map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'INTENT_ANALYZED', 'REQUIREMENTS_APPROVED', 'TOPOLOGY_APPROVED', 'STACK_SELECTED', 'SOLUTION_APPROVED', 'ARCHITECTURE_DECIDED', 'TEAM_COMPOSED', 'PIPELINE_COMPOSED',
    ]));
    expect(service.getEvents('application-1').some((event) => event.eventType === 'GENERATOR_STATE_CHANGED')).toBe(true);
    expect(service.getState('application-1')?.state).toBe('READY_FOR_EXECUTION');
    expect(service.getAuditEvents('application-1').length).toBe(service.getEvents('application-1').length);
  });

  it('exposes read models without recomputing the mission', () => {
    const service = new IntelligentGeneratorCommandService();
    const result = service.generate({ missionId: 'application-2', rawUserIdea: 'Quero uma API backend.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-2', result]]));
    expect(query.getCurrentIntent('application-2')?.missionId).toBe('application-2');
    expect(query.getPipeline('application-2')?.id).toBe(result.pipeline.id);
  });

  it('rejects a different command for an existing mission', () => {
    const service = new IntelligentGeneratorCommandService();
    service.generate({ missionId: 'application-conflict', rawUserIdea: 'Quero uma API.' });
    expect(() => service.generate({ missionId: 'application-conflict', rawUserIdea: 'Quero um aplicativo mobile.' })).toThrow('GENERATOR_COMMAND_CONFLICT');
  });

  it('keeps decision event reads in the query service', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-query-events', rawUserIdea: 'Quero uma API.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-query-events', result]]), command.getEventStore());
    expect(query.getDecisionEventsByType('application-query-events', 'SOLUTION_APPROVED')).toHaveLength(1);
  });

  it('accepts a repository implementation through the application boundary', () => {
    const repository = new InMemoryDecisionEventStore();
    const command = new IntelligentGeneratorCommandService(undefined, repository);
    command.generate({ missionId: 'application-repository', rawUserIdea: 'Quero uma API.' });
    expect(repository.list('application-repository').length).toBeGreaterThan(0);
  });

  it('opens a versioned replan boundary and records its reason', () => {
    const command = new IntelligentGeneratorCommandService();
    command.generate({ missionId: 'application-replan', rawUserIdea: 'Quero uma API.' });
    const current = command.getState('application-replan')!;
    const replanned = command.replan('application-replan', 'REQUIREMENTS_CHANGED', current.version);
    expect(replanned.state).toBe('SOLUTION_PLANNING');
    expect(command.getEventsByType('application-replan', 'GENERATOR_STATE_CHANGED').length).toBe(2);
  });

  it('exposes mission state through the query service', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-state-query', rawUserIdea: 'Quero uma API.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-state-query', result]]), command.getEventStore(), [], command.getStateMachine());
    expect(query.getMissionState('application-state-query')?.state).toBe('READY_FOR_EXECUTION');
  });

  it('creates a query service backed by the command service state', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-query-factory', rawUserIdea: 'Quero uma API.' });
    const query = command.createQueryService();
    expect(query.getApprovedSolution('application-query-factory')?.id).toBe(result.approvedSolution.id);
    expect(query.getMissionState('application-query-factory')?.state).toBe('READY_FOR_EXECUTION');
    expect(query.getDecisionEvents('application-query-factory').length).toBeGreaterThan(0);
  });

  it('exposes runtime task read models through the query boundary', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-runtime-query', rawUserIdea: 'Quero uma API.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-runtime-query', result]]), command.getEventStore(), [], command.getStateMachine());
    command.getEventStore().append({ missionId: 'application-runtime-query', eventType: 'EXECUTION_DISPATCHED', aggregateType: 'Execution', aggregateId: 'execution-query', idempotencyKey: 'execution-query', payload: { taskId: 'task-query', executionId: 'execution-query' } });
    expect(query.getRuntimeTaskOverview('application-runtime-query', 'task-query')).toEqual(expect.objectContaining({ executionStatus: 'DISPATCHED', nextAction: 'WAIT_RUNTIME' }));
    expect(query.getRuntimeMissionOverview('application-runtime-query')).toHaveLength(1);
    command.getEventStore().append({ missionId: 'application-runtime-query', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-query', idempotencyKey: 'failure-query', payload: { taskId: 'task-query', snapshotId: 'snapshot-query', category: 'TEST', failureCode: 'TEST_FAILED' } });
    expect(query.getRepairOverview('application-runtime-query', 'task-query')?.failureCode).toBe('TEST_FAILED');
    expect(query.getRepairMissionOverview('application-runtime-query')).toHaveLength(1);
    expect(query.getOperationalMissionOverview('application-runtime-query')).toEqual(expect.objectContaining({ runtimeTaskCount: 1, failedTaskCount: 0 }));
    expect(query.getOperationalActions('application-runtime-query')).toEqual(expect.arrayContaining([{ missionId: 'application-runtime-query', taskId: 'task-query', action: 'WAIT_RUNTIME', source: 'RUNTIME' }]));
    expect(query.getRuntimeEvents('application-runtime-query', 'task-query')).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: 'EXECUTION_DISPATCHED' })]));
    expect(query.getRepairEvents('application-runtime-query', 'task-query')).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: 'FAILURE_CLASSIFIED' })]));
  });

  it('aggregates operational counters from runtime and repair projections', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-operational-counters', rawUserIdea: 'Quero uma API.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-operational-counters', result]]), command.getEventStore(), [], command.getStateMachine());
    command.getEventStore().append({ missionId: 'application-operational-counters', eventType: 'EXECUTION_FAILED', aggregateType: 'Execution', aggregateId: 'execution-counter', idempotencyKey: 'failed-counter', payload: { taskId: 'task-counter', executionId: 'execution-counter', success: false } });
    command.getEventStore().append({ missionId: 'application-operational-counters', eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'snapshot-counter', idempotencyKey: 'failure-counter', payload: { taskId: 'task-counter', snapshotId: 'snapshot-counter', category: 'TEST', failureCode: 'TEST_FAILED' } });
    command.getEventStore().append({ missionId: 'application-operational-counters', eventType: 'REPAIR_ADVISORY_CREATED', aggregateType: 'RepairAdvisory', aggregateId: 'advisory-counter', idempotencyKey: 'advisory-counter', payload: { taskId: 'task-counter', failureCode: 'TEST_FAILED', specialistRole: 'TEST_ENGINEER', risk: 'MEDIUM' } });
    command.getEventStore().append({ missionId: 'application-operational-counters', eventType: 'REPAIR_ELIGIBILITY_EVALUATED', aggregateType: 'RepairEligibilityDecision', aggregateId: 'eligibility-counter', idempotencyKey: 'eligibility-counter', payload: { taskId: 'task-counter', status: 'ELIGIBLE', attemptCount: 1, maxAttempts: 3, requiresApproval: false } });
    expect(query.getOperationalMissionOverview('application-operational-counters')).toEqual(expect.objectContaining({ failedTaskCount: 1, repairPendingCount: 1 }));
    expect(query.getOperationalActions('application-operational-counters')).toEqual([{ missionId: 'application-operational-counters', taskId: 'task-counter', action: 'START_REPAIR', source: 'REPAIR' }]);
  });

  it('provides all framework-neutral data required by an operational API', () => {
    const command = new IntelligentGeneratorCommandService();
    const result = command.generate({ missionId: 'application-api-contract', rawUserIdea: 'Quero uma API.' });
    const query = new IntelligentGeneratorQueryService(new Map([['application-api-contract', result]]), command.getEventStore(), [], command.getStateMachine());
    const response = { overview: query.getOperationalMissionOverview('application-api-contract'), actions: query.getOperationalActions('application-api-contract'), runtimeTasks: query.getRuntimeMissionOverview('application-api-contract'), repairTasks: query.getRepairMissionOverview('application-api-contract') };
    expect(response.overview.missionId).toBe('application-api-contract');
    expect(response.runtimeTasks).toEqual([]);
    expect(response.repairTasks).toEqual([]);
  });
});
