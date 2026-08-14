import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DecisionEventDto, RuntimeClient } from '../../core/api/runtime.client';
import { RepairClient } from '../../core/api/repair.client';
import { AppError } from '../../core/errors/error-mapper';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { EventTimelineComponent } from '../../shared/ui/event-timeline/event-timeline';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { ButtonComponent } from '../../shared/ui/button/button';
import { ClassifyFailureDialogComponent } from './classify-failure-dialog/classify-failure-dialog';

/**
 * doc 44 F7 "Repair timeline" + follow-up "aprovação de reparo real". `RepairOverview.advisory`/
 * `.eligibility` (the nested objects RepairReadModel fabricates — core/src/services/
 * repair-read-model.ts) mix real fields with hardcoded-empty ones (approvedSolutionId/
 * likelyCapabilities/rationale/reason), so this view still never reads them — only the top-level
 * RepairOverview fields (all real, assigned straight from event payloads) plus the raw repair
 * event timeline (100% real payloads).
 *
 * "Classificar falha" and "Aprovar reparo" are now real actions (apps/api/src/repair/) instead
 * of the placeholder caption this page used to show — task.nextAction === 'APPROVE_REPAIR' is
 * computed by the same read model from the real REPAIR_ELIGIBILITY_EVALUATED events these
 * actions write, so no extra client-side state is needed to know when to show the button.
 */
@Component({
  selector: 'app-mission-repair',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, EventTimelineComponent, ErrorStateComponent, SkeletonComponent, ButtonComponent, ClassifyFailureDialogComponent],
  templateUrl: './mission-repair.html',
  styleUrl: './mission-repair.scss',
})
export class MissionRepairComponent {
  readonly missionId = input.required<string>();

  private readonly runtimeClient = inject(RuntimeClient);
  private readonly repairClient = inject(RepairClient);

  protected readonly missionResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getMission(missionId)),
  });

  protected readonly eventsResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.runtimeClient.getEvents(missionId)),
  });

  private static readonly REPAIR_EVENT_TYPES = new Set(['FAILURE_CLASSIFIED', 'REPAIR_ADVISORY_CREATED', 'REPAIR_ELIGIBILITY_EVALUATED', 'REPAIR_COMPLETED']);

  protected readonly repairEvents = computed<DecisionEventDto[]>(() => {
    const events = this.eventsResource.value()?.runtime ?? [];
    return events
      .filter((event) => MissionRepairComponent.REPAIR_EVENT_TYPES.has(event.eventType))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  protected readonly dialogOpen = signal(false);
  protected readonly approvingTaskId = signal<string | null>(null);
  protected readonly approveError = signal<AppError | null>(null);

  openClassifyDialog(): void {
    this.dialogOpen.set(true);
  }

  onDialogClosed(): void {
    this.dialogOpen.set(false);
    this.reload();
  }

  approve(taskId: string): void {
    if (this.approvingTaskId()) return;
    this.approvingTaskId.set(taskId);
    this.approveError.set(null);
    this.repairClient.assessEligibility(this.missionId(), taskId, { approvalGranted: true }).subscribe({
      next: () => {
        this.approvingTaskId.set(null);
        this.reload();
      },
      error: (error: AppError) => {
        this.approvingTaskId.set(null);
        this.approveError.set(error);
      },
    });
  }

  private reload(): void {
    this.missionResource.reload();
    this.eventsResource.reload();
  }
}
