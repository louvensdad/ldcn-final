import { randomUUID } from 'node:crypto';
import { AppendDecisionEventInput, DecisionEventRepository, GeneratorDecisionEvent, GeneratorDecisionEventType } from 'ldcn-core';

/**
 * core/src/services/intelligent-generator-application.ts consumes DecisionEventRepository
 * synchronously (it appends several events in a row while composing a GenerationResult), but
 * Prisma is inherently async. We bridge the two with a per-request "hydrate → run core
 * synchronously → flush" adapter instead of touching core/: this class holds a mission's
 * existing events in memory (seeded from Postgres before the call) and exposes exactly the
 * events appended *during* this call so the caller can persist only the delta afterwards.
 *
 * Logic ported 1:1 from core/src/services/json-decision-event-store.ts (append-only,
 * idempotencyKey uniqueness, per-mission monotonic version, payload sanitization).
 */
export class HydratedDecisionEventStore implements DecisionEventRepository {
  private events: GeneratorDecisionEvent[];
  private readonly byIdempotency = new Map<string, GeneratorDecisionEvent>();
  private readonly newlyAppended: GeneratorDecisionEvent[] = [];

  constructor(seed: readonly GeneratorDecisionEvent[] = []) {
    this.events = [...seed];
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
      id: randomUUID(),
      missionId: input.missionId,
      version: currentVersion + 1,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      idempotencyKey: input.idempotencyKey,
      payload: this.sanitize(input.payload ?? {}),
      createdAt: Date.now(),
    };
    this.events.push(event);
    this.byIdempotency.set(event.idempotencyKey, event);
    this.newlyAppended.push(event);
    return event;
  }

  list(missionId: string): readonly GeneratorDecisionEvent[] {
    return this.events.filter((event) => event.missionId === missionId);
  }

  listByType(missionId: string, eventType: GeneratorDecisionEventType): readonly GeneratorDecisionEvent[] {
    return this.list(missionId).filter((event) => event.eventType === eventType);
  }

  listByAggregate(missionId: string, aggregateType: string, aggregateId?: string): readonly GeneratorDecisionEvent[] {
    return this.list(missionId).filter((event) => event.aggregateType === aggregateType && (!aggregateId || event.aggregateId === aggregateId));
  }

  findByIdempotencyKey(key: string): GeneratorDecisionEvent | undefined {
    return this.byIdempotency.get(key);
  }

  /** Events appended during this request, not present in the Postgres-backed seed — what the caller must flush. */
  getNewlyAppended(): readonly GeneratorDecisionEvent[] {
    return this.newlyAppended;
  }

  private sanitize(payload: Record<string, unknown>): Record<string, string | number | boolean | null> {
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (/secret|token|password|api.?key|chain.?of.?thought|cot|hidden.?reasoning/i.test(key)) continue;
      if (value === null || typeof value === 'number' || typeof value === 'boolean') result[key] = value;
      else if (typeof value === 'string')
        result[key] = value
          .replace(/((?:api[_ -]?key|token|secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
          .replace(/(?:chain.?of.?thought|hidden deliberation|private reasoning)\s*[:=]?\s*[^.;]+/gi, '[OMITTED_PRIVATE_REASONING]');
    }
    return result;
  }
}
