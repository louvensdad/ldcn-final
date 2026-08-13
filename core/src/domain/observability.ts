export type GeneratorSpanName = 'intent' | 'requirements' | 'topology' | 'solution' | 'architecture' | 'team' | 'pipeline' | 'job-classification' | 'job-routing' | 'team-switch' | 'handoff' | 'learning';

export interface TraceSpan {
  traceId: string;
  missionId: string;
  name: GeneratorSpanName;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  attributes: Record<string, string | number | boolean | null>;
}

export interface AuditEvent {
  id: string;
  traceId: string;
  missionId: string;
  eventType: string;
  stage: GeneratorSpanName;
  entityId?: string;
  entityVersion?: number;
  contextHash?: string;
  rationale?: string;
  attributes: Record<string, string | number | boolean | null>;
  createdAt: number;
}
