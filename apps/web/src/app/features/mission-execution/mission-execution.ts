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
 * doc 44 F6 (Execution viewer). Scoped down to what the backend actually has: a status/timeline
 * read model derived from the DecisionEvent log (GET /missions/:id/operations[/events]), already
 * implemented since the backend Slices but never consumed. Build/Test console, Evidence and
 * Artifacts are out of scope — core/Prisma have no Artifact/Evidence/build-log domain yet.
 *
 * Because generate() is still atomic and never dispatches real execution, EXECUTION_DISPATCHED
 * and friends are never emitted today — every mission shows the empty state until a real
 * execution runtime lands. That's an honest reflection of backend state, not a frontend bug.
 */
@Component({
  selector: 'app-mission-execution',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, EventTimelineComponent, ErrorStateComponent, SkeletonComponent],
  templateUrl: './mission-execution.html',
  styleUrl: './mission-execution.scss',
})
export class MissionExecutionComponent {
  readonly missionId = input.required<string>();

  private readonly runtimeClient = inject(RuntimeClient);

  protected readonly missionResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getMission(missionId)),
  });

  protected readonly eventsResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getEvents(missionId)),
  });

  /**
   * The backend's getRuntimeEvents() returns the mission's *entire* decision log (only
   * taskId-filtered, not type-filtered) — unlike getRepairEvents(), which already filters by
   * type. Filtering here to execution-related types keeps this tab honestly about execution,
   * instead of duplicating INTENT_ANALYZED/TEAM_COMPOSED/etc. that other tabs already show.
   */
  private static readonly EXECUTION_EVENT_TYPES = new Set(['EXECUTION_DISPATCHED', 'EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'GATE_EVALUATED', 'REVIEW_COMPLETED']);

  protected readonly sortedEvents = computed<DecisionEventDto[]>(() => {
    const events = this.eventsResource.value()?.runtime ?? [];
    return events
      .filter((event) => MissionExecutionComponent.EXECUTION_EVENT_TYPES.has(event.eventType))
      .sort((left, right) => right.createdAt - left.createdAt);
  });
}
