import { Component, input } from '@angular/core';
import { DecisionEventDto } from '../../../core/api/runtime.client';

/**
 * Generic renderer for GeneratorDecisionEvent[] (already sorted/filtered by the caller). Payload
 * is rendered as raw key:value pairs — no per-eventType structure assumed, same "no
 * chain-of-thought, no reinterpretation" spirit already applied to Architecture decision cards.
 * Extracted from mission-execution.ts (F6) so Gates/Repair (F7) reuse it instead of duplicating.
 */
@Component({
  selector: 'app-event-timeline',
  templateUrl: './event-timeline.html',
  styleUrl: './event-timeline.scss',
})
export class EventTimelineComponent {
  readonly events = input.required<DecisionEventDto[]>();

  protected payloadEntries(payload: Record<string, string | number | boolean | null>): [string, string | number | boolean | null][] {
    return Object.entries(payload);
  }

  protected formatEventTime(createdAt: number): string {
    return new Date(createdAt).toLocaleString();
  }
}
