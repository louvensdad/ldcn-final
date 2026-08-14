import { Component, computed, inject, input, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DecisionEventDto, RuntimeClient } from '../../core/api/runtime.client';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { EventTimelineComponent } from '../../shared/ui/event-timeline/event-timeline';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/**
 * doc 44 F7 "Review Center" + "Gate Center", collapsed into one tab: both are driven by exactly
 * the same two event types (GATE_EVALUATED, REVIEW_COMPLETED — runtime-audit-recorder.ts) with no
 * further distinction in the backend, so two near-identical screens would be pure padding.
 *
 * There is no ReviewGateEvaluation read model at all (unlike RuntimeTaskOverview for F6) — this
 * tab is built entirely from the raw event log, same honest-viewer approach as Execution (F6).
 */
@Component({
  selector: 'app-mission-gates',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, EventTimelineComponent, ErrorStateComponent, SkeletonComponent],
  templateUrl: './mission-gates.html',
  styleUrl: './mission-gates.scss',
})
export class MissionGatesComponent {
  readonly missionId = input.required<string>();

  private readonly runtimeClient = inject(RuntimeClient);

  protected readonly eventsResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getEvents(missionId)),
  });

  private static readonly GATE_EVENT_TYPES = new Set(['GATE_EVALUATED', 'REVIEW_COMPLETED']);

  protected readonly gateEvents = computed<DecisionEventDto[]>(() => {
    const events = this.eventsResource.value()?.runtime ?? [];
    return events
      .filter((event) => MissionGatesComponent.GATE_EVENT_TYPES.has(event.eventType))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  protected readonly summary = computed(() => {
    const events = this.gateEvents();
    return {
      passed: events.filter((event) => event.payload['status'] === 'PASSED').length,
      failed: events.filter((event) => event.payload['status'] === 'FAILED').length,
      blocked: events.filter((event) => event.payload['status'] === 'BLOCKED').length,
    };
  });
}
