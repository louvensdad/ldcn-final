import { ObservabilityTracer } from '../services/observability-tracer';

describe('ObservabilityTracer', () => {
  it('records a span and auditable decision metadata', () => {
    const tracer = new ObservabilityTracer();
    const span = tracer.span('obs-1', 'job-routing', { stack: 'java' }, () => undefined);
    const event = tracer.audit({ traceId: span.traceId, missionId: 'obs-1', eventType: 'ROUTING_DECISION', stage: 'job-routing', entityId: 'decision-1', entityVersion: 1, rationale: 'Selected token=hidden safe executor', attributes: { policy: 'deterministic', apiKey: 'secret' } });
    expect(span.status).toBe('OK');
    expect(span.durationMs).toBeGreaterThanOrEqual(0);
    expect(event.rationale).toContain('[REDACTED]');
    expect(event.attributes).toEqual({ policy: 'deterministic' });
  });

  it('marks failed spans and keeps mission filtering', () => {
    const tracer = new ObservabilityTracer();
    expect(() => tracer.span('obs-a', 'pipeline', {}, () => { throw new Error('blocked'); })).toThrow('blocked');
    tracer.span('obs-b', 'pipeline');
    expect(tracer.getSpans('obs-a')[0].status).toBe('ERROR');
    expect(tracer.getSpans('obs-b')).toHaveLength(1);
  });
});
