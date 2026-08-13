import { InMemoryDecisionEventStore } from '../services/decision-event-store';
import { DecisionEventRepository } from '../services/decision-event-store';

describe('InMemoryDecisionEventStore', () => {
  it('implements the persistence boundary', () => {
    const repository: DecisionEventRepository = new InMemoryDecisionEventStore();
    expect(repository.list('missing')).toEqual([]);
  });

  it('is append-only and retry-safe by idempotency key', () => {
    const store = new InMemoryDecisionEventStore();
    const input = { missionId: 'events-1', eventType: 'SOLUTION_APPROVED' as const, aggregateType: 'ApprovedSolution', aggregateId: 'solution-1', idempotencyKey: 'approve:solution-1', payload: { mode: 'AUTO' } };
    const first = store.append(input);
    const retry = store.append(input);
    expect(retry).toBe(first);
    expect(store.list('events-1')).toHaveLength(1);
  });

  it('versions events per mission and excludes sensitive payloads', () => {
    const store = new InMemoryDecisionEventStore();
    const first = store.append({ missionId: 'events-2', eventType: 'JOB_CLASSIFIED', aggregateType: 'JobClassification', aggregateId: 'job-1', idempotencyKey: 'classify:job-1', payload: { jobType: 'BACKEND_IMPLEMENTATION', apiKey: 'secret' } });
    const second = store.append({ missionId: 'events-2', eventType: 'JOB_ROUTED', aggregateType: 'WorkRoutingDecision', aggregateId: 'route-1', idempotencyKey: 'route:job-1' });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(first.payload).toEqual({ jobType: 'BACKEND_IMPLEMENTATION' });
    const sanitized = store.append({ missionId: 'events-2', eventType: 'JOB_ROUTED', aggregateType: 'WorkRoutingDecision', aggregateId: 'route-2', idempotencyKey: 'route:job-2', payload: { message: 'token=hidden-value' } });
    expect(sanitized.payload.message).toBe('token=[REDACTED]');
    const privateReasoning = store.append({ missionId: 'events-2', eventType: 'JOB_ROUTED', aggregateType: 'WorkRoutingDecision', aggregateId: 'route-3', idempotencyKey: 'route:job-3', payload: { message: 'private reasoning: internal deliberation. result=allowed' } });
    expect(privateReasoning.payload.message).toContain('[OMITTED_PRIVATE_REASONING]');
  });

  it('rejects stale optimistic writes', () => {
    const store = new InMemoryDecisionEventStore();
    store.append({ missionId: 'events-3', eventType: 'INTENT_ANALYZED', aggregateType: 'ProjectIntent', aggregateId: 'intent-1', idempotencyKey: 'intent:1' });
    expect(() => store.append({ missionId: 'events-3', eventType: 'SOLUTION_APPROVED', aggregateType: 'ApprovedSolution', aggregateId: 'solution-1', idempotencyKey: 'solution:1', expectedVersion: 0 })).toThrow('GENERATOR_CONTEXT_STALE');
  });

  it('queries the append-only ledger by type and aggregate', () => {
    const store = new InMemoryDecisionEventStore();
    store.append({ missionId: 'events-4', eventType: 'JOB_CLASSIFIED', aggregateType: 'JobClassification', aggregateId: 'job-1', idempotencyKey: 'classify:4' });
    store.append({ missionId: 'events-4', eventType: 'JOB_ROUTED', aggregateType: 'WorkRoutingDecision', aggregateId: 'route-1', idempotencyKey: 'route:4' });
    expect(store.listByType('events-4', 'JOB_ROUTED')).toHaveLength(1);
    expect(store.listByAggregate('events-4', 'JobClassification', 'job-1')).toHaveLength(1);
    expect(store.findByIdempotencyKey('classify:4')?.aggregateId).toBe('job-1');
  });

  it('blocks idempotency key reuse across missions', () => {
    const store = new InMemoryDecisionEventStore();
    store.append({ missionId: 'events-cross-a', eventType: 'JOB_CLASSIFIED', aggregateType: 'Job', aggregateId: 'job-a', idempotencyKey: 'shared-key' });
    expect(() => store.append({ missionId: 'events-cross-b', eventType: 'JOB_CLASSIFIED', aggregateType: 'Job', aggregateId: 'job-b', idempotencyKey: 'shared-key' })).toThrow('DECISION_EVENT_IDEMPOTENCY_CONFLICT');
  });
});
