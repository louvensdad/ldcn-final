import { AuditEvent, GeneratorSpanName, TraceSpan } from '../domain';
import { generateId } from '../utils/id';

export class ObservabilityTracer {
  private spans: TraceSpan[] = [];
  private events: AuditEvent[] = [];

  span(missionId: string, name: GeneratorSpanName, attributes: Record<string, unknown> = {}, work?: () => void): TraceSpan {
    const traceId = generateId();
    const startedAt = Date.now();
    let status: TraceSpan['status'] = 'OK';
    try { work?.(); } catch (error) { status = 'ERROR'; throw error; }
    finally {
      const endedAt = Date.now();
      const span = { traceId, missionId, name, startedAt, endedAt, durationMs: endedAt - startedAt, status, attributes: this.sanitize(attributes) };
      this.spans.push(span);
    }
    return this.spans[this.spans.length - 1];
  }

  audit(input: { traceId: string; missionId: string; eventType: string; stage: GeneratorSpanName; entityId?: string; entityVersion?: number; contextHash?: string; rationale?: string; attributes?: Record<string, unknown> }): AuditEvent {
    const event: AuditEvent = {
      id: generateId(), traceId: input.traceId, missionId: input.missionId,
      eventType: input.eventType, stage: input.stage, entityId: input.entityId,
      entityVersion: input.entityVersion, contextHash: input.contextHash,
      rationale: input.rationale ? this.sanitizeText(input.rationale) : undefined,
      attributes: this.sanitize(input.attributes ?? {}), createdAt: Date.now(),
    };
    this.events.push(event);
    return event;
  }

  getSpans(missionId?: string): readonly TraceSpan[] { return this.spans.filter((span) => !missionId || span.missionId === missionId); }
  getAuditEvents(missionId?: string): readonly AuditEvent[] { return this.events.filter((event) => !missionId || event.missionId === missionId); }

  private sanitize(values: Record<string, unknown>): Record<string, string | number | boolean | null> {
    const result: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(values)) {
      if (/secret|token|password|api.?key|chain.?of.?thought|cot|hidden.?reasoning/i.test(key)) continue;
      if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') result[key] = typeof value === 'string' ? this.sanitizeText(value) : value;
    }
    return result;
  }
  private sanitizeText(value: string): string { return value.replace(/(?:api[_ -]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]'); }
}
