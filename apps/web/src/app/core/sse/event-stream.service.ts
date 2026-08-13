import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { API_CONFIG } from '../api/api-config';
import { AuthService } from '../auth/auth.service';

export type ConnectionState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

/** Wire shape from apps/api/src/events/frontend-event.ts (doc 36 §68). */
export interface FrontendEvent<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  missionId?: string;
  taskId?: string;
  operationId?: string;
  payload: T;
}

/** Must match the event names apps/api/src/operations/operations.controller.ts emits (doc 42 §4/§67). */
const KNOWN_EVENT_TYPES = [
  'operation.started',
  'operation.completed',
  'operation.failed',
  'mission.state.changed',
  'mission.solution.approved',
  'team.composed',
  'pipeline.updated',
];

/**
 * doc 40 §11 (MissionEventStreamService). Native EventSource can't set custom headers, so auth
 * goes through the `?apiKey=` fallback the backend's ApiKeyGuard already supports.
 *
 * Foundation scope only: connect/disconnect/events$/connectionState exist and are wired into
 * the shell, but no feature reacts to events$ yet — that starts at F3 (Command Center).
 */
@Injectable({ providedIn: 'root' })
export class EventStreamService {
  private readonly config = inject(API_CONFIG);
  private readonly auth = inject(AuthService);
  private eventSource: EventSource | null = null;
  private readonly eventsSubject = new Subject<FrontendEvent>();

  readonly events$ = this.eventsSubject.asObservable();
  readonly connectionState = signal<ConnectionState>('IDLE');

  connect(): void {
    if (this.eventSource) return;
    const apiKey = this.auth.apiKey();
    const url = `${this.config.baseUrl}/stream${apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : ''}`;

    this.connectionState.set('CONNECTING');
    const source = new EventSource(url);
    this.eventSource = source;

    source.onopen = () => this.connectionState.set('CONNECTED');
    source.onerror = () => {
      const reconnecting = source.readyState === EventSource.CONNECTING;
      this.connectionState.set(reconnecting ? 'RECONNECTING' : 'DISCONNECTED');
    };

    for (const type of KNOWN_EVENT_TYPES) {
      source.addEventListener(type, (raw: MessageEvent) => this.eventsSubject.next(this.parse(raw)));
    }
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectionState.set('DISCONNECTED');
  }

  private parse(raw: MessageEvent<string>): FrontendEvent {
    try {
      return JSON.parse(raw.data) as FrontendEvent;
    } catch {
      return { id: raw.lastEventId, type: 'unknown', occurredAt: new Date().toISOString(), payload: raw.data };
    }
  }
}
