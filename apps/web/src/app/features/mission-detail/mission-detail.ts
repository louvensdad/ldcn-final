import { Component, DestroyRef, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';
import { MissionClient } from '../../core/api/mission.client';
import { EventStreamService } from '../../core/sse/event-stream.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../shared/ui/button/button';
import { StageRailComponent } from '../../shared/ui/stage-rail/stage-rail';
import { MissionOverviewCardsComponent } from '../../shared/ui/mission-overview-cards/mission-overview-cards';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

/** Events that mean "this mission's overview may have changed" — see apps/api/src/events/frontend-event.ts for the full type list. */
const RELOAD_EVENT_TYPES = new Set(['mission.state.changed', 'team.composed', 'pipeline.updated', 'operation.completed', 'operation.failed']);

/**
 * doc 44 F3 (Command Center). First feature that actually reacts to EventStreamService.events$
 * — until now only the connection indicator used it. /stream is a single global connection
 * (doc 42 §4), so every consumer has to filter by missionId itself; nothing here assumes the
 * stream is already scoped to this mission.
 */
@Component({
  selector: 'app-mission-detail',
  imports: [TranslatePipe, ButtonComponent, StageRailComponent, MissionOverviewCardsComponent, MissionNavComponent, RouterLink, ErrorStateComponent, SkeletonComponent],
  templateUrl: './mission-detail.html',
  styleUrl: './mission-detail.scss',
})
export class MissionDetailComponent {
  readonly missionId = input.required<string>();

  private readonly missionClient = inject(MissionClient);
  private readonly eventStream = inject(EventStreamService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly overviewResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.missionClient.getOverview(missionId)),
  });

  constructor() {
    const subscription = this.eventStream.events$
      .pipe(filter((event) => event.missionId === this.missionId() && RELOAD_EVENT_TYPES.has(event.type)))
      .subscribe(() => this.overviewResource.reload());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  goToWorkspace(): void {
    void this.router.navigateByUrl('/');
  }
}
