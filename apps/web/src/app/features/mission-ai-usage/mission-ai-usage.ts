import { Component, computed, inject, input, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DecisionEventDto, RuntimeClient } from '../../core/api/runtime.client';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { EventTimelineComponent } from '../../shared/ui/event-timeline/event-timeline';

/**
 * doc 43 §11 "AI Usage visibility" (model/provider/tokens/latency — no cost, see
 * mission-ai-usage's sibling AssistantService for why cost isn't tracked). Every "Explicar com
 * IA" call already records an AI_EXPLANATION_GENERATED DecisionEvent — this tab is purely a
 * read view over that, same honest-viewer technique as Gates/Repair (F6/F7): filter the mission's
 * raw event log (GET .../operations/events, already used by RuntimeClient) client-side instead
 * of adding a new backend endpoint.
 */
@Component({
  selector: 'app-mission-ai-usage',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, ErrorStateComponent, EventTimelineComponent],
  templateUrl: './mission-ai-usage.html',
  styleUrl: './mission-ai-usage.scss',
})
export class MissionAiUsageComponent {
  readonly missionId = input.required<string>();

  private readonly runtimeClient = inject(RuntimeClient);

  protected readonly eventsResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getEvents(missionId)),
  });

  private static readonly AI_USAGE_EVENT_TYPES = new Set(['AI_EXPLANATION_GENERATED']);

  protected readonly aiEvents = computed<DecisionEventDto[]>(() => {
    const events = this.eventsResource.value()?.runtime ?? [];
    return events
      .filter((event) => MissionAiUsageComponent.AI_USAGE_EVENT_TYPES.has(event.eventType))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  protected readonly summary = computed(() => {
    const events = this.aiEvents();
    const totalTokens = events.reduce((sum, event) => sum + (Number(event.payload['totalUnits']) || 0), 0);
    const avgLatency = events.length ? Math.round(events.reduce((sum, event) => sum + (Number(event.payload['latencyMs']) || 0), 0) / events.length) : 0;
    return { count: events.length, totalTokens, avgLatency };
  });
}
