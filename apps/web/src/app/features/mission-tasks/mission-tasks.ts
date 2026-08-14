import { Component, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskClient } from '../../core/api/task.client';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { ButtonComponent } from '../../shared/ui/button/button';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { NewTaskDialogComponent } from './new-task-dialog/new-task-dialog';

/** doc 44 F5 ("Task board"). Backed by the new GET /missions/:id/tasks (apps/api TasksController) — nothing to list tasks existed before this slice. */
@Component({
  selector: 'app-mission-tasks',
  imports: [TranslatePipe, MissionNavComponent, ButtonComponent, EmptyStateComponent, ErrorStateComponent, NewTaskDialogComponent, RouterLink, SkeletonComponent],
  templateUrl: './mission-tasks.html',
  styleUrl: './mission-tasks.scss',
})
export class MissionTasksComponent {
  readonly missionId = input.required<string>();

  private readonly taskClient = inject(TaskClient);
  private readonly router = inject(Router);

  protected readonly dialogOpen = signal(false);
  private lastFocusedElement: HTMLElement | null = null;
  protected readonly tasksResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.taskClient.list(missionId)),
  });

  openDialog(): void {
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.dialogOpen.set(true);
  }

  onDialogClosed(taskId: string | undefined): void {
    this.dialogOpen.set(false);
    this.lastFocusedElement?.focus();
    if (taskId) void this.router.navigate(['/missions', this.missionId(), 'tasks', taskId]);
    else this.tasksResource.reload();
  }
}
