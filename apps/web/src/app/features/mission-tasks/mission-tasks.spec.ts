import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MissionTasksComponent } from './mission-tasks';
import { JobClassificationDto, TaskClient, TaskSummaryDto } from '../../core/api/task.client';

function classification(overrides: Partial<JobClassificationDto> = {}): JobClassificationDto {
  return {
    id: 'c-1',
    missionId: 'm-1',
    taskId: 't-1',
    jobType: 'FRONTEND_IMPLEMENTATION',
    affectedStacks: ['stack.typescript.nextjs'],
    affectedDomains: [],
    complexity: 'LOW',
    riskLevel: 'LOW',
    requiredCapabilities: [],
    requiresArchitectureReview: false,
    requiresSecurityReview: false,
    requiresDataSpecialist: false,
    requiresRuntimeSpecialist: false,
    requiresIntegration: false,
    scopeExpansionRequired: false,
    contextHash: 'hash',
    ...overrides,
  };
}

describe('MissionTasksComponent', () => {
  function setup(list: (missionId: string) => ReturnType<TaskClient['list']>) {
    TestBed.configureTestingModule({
      imports: [MissionTasksComponent],
      providers: [provideRouter([]), { provide: TaskClient, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(MissionTasksComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no tasks', async () => {
    const fixture = setup((_missionId: string) => of([]));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('renders one item per task with its job type and routing status', async () => {
    const tasks: TaskSummaryDto[] = [
      { taskId: 't-1', classification: classification(), routingStatus: 'ROUTED' },
      { taskId: 't-2', classification: classification({ taskId: 't-2', jobType: 'BUG_FIX' }) },
    ];
    const fixture = setup((_missionId: string) => of(tasks));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('FRONTEND_IMPLEMENTATION');
    expect(html).toContain('ROUTED');
    expect(html).toContain('BUG_FIX');
  });

  it('navigates to the new task on dialog close with a taskId', async () => {
    const fixture = setup((_missionId: string) => of([]));
    await fixture.whenStable();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.componentInstance.onDialogClosed('new-task-id');

    expect(navigateSpy).toHaveBeenCalledWith(['/missions', 'm-1', 'tasks', 'new-task-id']);
  });

  it('returns focus to the element that opened the dialog once it closes', async () => {
    const fixture = setup((_missionId: string) => of([]));
    await fixture.whenStable();
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    fixture.componentInstance.openDialog();
    fixture.componentInstance.onDialogClosed(undefined);

    expect(document.activeElement).toBe(trigger);

    document.body.innerHTML = '';
  });
});
