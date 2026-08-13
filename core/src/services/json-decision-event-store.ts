import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GeneratorDecisionEvent, GeneratorDecisionEventType } from '../domain';
import { generateId } from '../utils/id';
import { AppendDecisionEventInput, DecisionEventRepository } from './decision-event-store';

/** Durable local adapter with the same invariants as the in-memory event store. */
export class JsonDecisionEventStore implements DecisionEventRepository {
  private events: GeneratorDecisionEvent[];
  private byIdempotency = new Map<string, GeneratorDecisionEvent>();

  constructor(private readonly filePath: string) {
    this.events = this.read();
    for (const event of this.events) this.byIdempotency.set(event.idempotencyKey, event);
  }

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
    this.events.push(event); this.byIdempotency.set(event.idempotencyKey, event); this.persist();
    return event;
  }

  list(missionId: string): readonly GeneratorDecisionEvent[] { return this.events.filter((event) => event.missionId === missionId); }
  listByType(missionId: string, eventType: GeneratorDecisionEventType): readonly GeneratorDecisionEvent[] { return this.list(missionId).filter((event) => event.eventType === eventType); }
  listByAggregate(missionId: string, aggregateType: string, aggregateId?: string): readonly GeneratorDecisionEvent[] {
    return this.list(missionId).filter((event) => event.aggregateType === aggregateType && (!aggregateId || event.aggregateId === aggregateId));
  }
  findByIdempotencyKey(key: string): GeneratorDecisionEvent | undefined { return this.byIdempotency.get(key); }

  private read(): GeneratorDecisionEvent[] {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(value)) throw new Error('DECISION_EVENT_STORE_INVALID');
      return value as GeneratorDecisionEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.events), 'utf8');
    renameSync(temporary, this.filePath);
  }

  private sanitize(payload: Record<string, unknown>): Record<string, string | number | boolean | null> {
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (/secret|token|password|api.?key|chain.?of.?thought|cot|hidden.?reasoning/i.test(key)) continue;
      if (value === null || typeof value === 'number' || typeof value === 'boolean') result[key] = value;
      else if (typeof value === 'string') result[key] = value.replace(/((?:api[_ -]?key|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
    }
    return result;
  }
}
