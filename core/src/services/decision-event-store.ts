import { GeneratorDecisionEvent, GeneratorDecisionEventType } from '../domain';
import { generateId } from '../utils/id';

export interface AppendDecisionEventInput {
  missionId: string;
  eventType: GeneratorDecisionEventType;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  expectedVersion?: number;
}

export interface DecisionEventRepository {
  append(input: AppendDecisionEventInput): GeneratorDecisionEvent;
  list(missionId: string): readonly GeneratorDecisionEvent[];
  listByType(missionId: string, eventType: GeneratorDecisionEventType): readonly GeneratorDecisionEvent[];
  listByAggregate(missionId: string, aggregateType: string, aggregateId?: string): readonly GeneratorDecisionEvent[];
  findByIdempotencyKey(key: string): GeneratorDecisionEvent | undefined;
}

/** Append-only, retry-safe store; replaceable by a Prisma repository later. */
export class InMemoryDecisionEventStore implements DecisionEventRepository {
  private events: GeneratorDecisionEvent[] = [];
  private byIdempotency = new Map<string, GeneratorDecisionEvent>();

  append(input: AppendDecisionEventInput): GeneratorDecisionEvent {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing) {
      if (existing.missionId !== input.missionId) throw new Error('DECISION_EVENT_IDEMPOTENCY_CONFLICT');
      return existing;
    }
    const currentVersion = this.events.filter((event) => event.missionId === input.missionId).length;
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) throw new Error('GENERATOR_CONTEXT_STALE');
    const event: GeneratorDecisionEvent = {
      id: generateId(), missionId: input.missionId, version: currentVersion + 1,
      eventType: input.eventType, aggregateType: input.aggregateType, aggregateId: input.aggregateId,
      idempotencyKey: input.idempotencyKey, payload: this.sanitize(input.payload ?? {}), createdAt: Date.now(),
    };
    this.events.push(event);
    this.byIdempotency.set(input.idempotencyKey, event);
    return event;
  }

  list(missionId: string): readonly GeneratorDecisionEvent[] { return this.events.filter((event) => event.missionId === missionId); }
  listByType(missionId: string, eventType: GeneratorDecisionEventType): readonly GeneratorDecisionEvent[] { return this.list(missionId).filter((event) => event.eventType === eventType); }
  listByAggregate(missionId: string, aggregateType: string, aggregateId?: string): readonly GeneratorDecisionEvent[] {
    return this.list(missionId).filter((event) => event.aggregateType === aggregateType && (!aggregateId || event.aggregateId === aggregateId));
  }
  findByIdempotencyKey(key: string): GeneratorDecisionEvent | undefined { return this.byIdempotency.get(key); }

  private sanitize(payload: Record<string, unknown>): Record<string, string | number | boolean | null> {
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (/secret|token|password|api.?key|chain.?of.?thought|cot|hidden.?reasoning/i.test(key)) continue;
      if (value === null || typeof value === 'number' || typeof value === 'boolean') result[key] = value;
      else if (typeof value === 'string') result[key] = value
        .replace(/((?:api[_ -]?key|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
        .replace(/(?:chain.?of.?thought|hidden deliberation|private reasoning)\s*[:=]?\s*[^.;]+/gi, '[OMITTED_PRIVATE_REASONING]');
    }
    return result;
  }
}
