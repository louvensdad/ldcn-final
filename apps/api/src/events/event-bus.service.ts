import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { FrontendEvent, FrontendEventType } from './frontend-event';

/**
 * In-process broadcaster for SSE (doc 42 §4). Single-process only, no Redis/fan-out — matches
 * the scope already cut in Slices 1-2 (no multi-instance concerns yet). A dropped connection
 * just misses events emitted while disconnected; there is no event replay/backlog.
 */
@Injectable()
export class EventBusService {
  private readonly subject = new Subject<FrontendEvent>();

  emit<T>(type: FrontendEventType, payload: T, refs: { missionId?: string; taskId?: string; operationId?: string } = {}): FrontendEvent<T> {
    const event: FrontendEvent<T> = { id: randomUUID(), type, occurredAt: new Date().toISOString(), payload, ...refs };
    this.subject.next(event);
    return event;
  }

  stream(): Observable<FrontendEvent> {
    return this.subject.asObservable();
  }
}
