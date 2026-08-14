import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionRepairComponent } from './mission-repair';
import { RuntimeClient, RuntimeEventsResponseDto, RuntimeOperationalResponseDto } from '../../core/api/runtime.client';
import { RepairClient, RepairEligibilityDecisionDto } from '../../core/api/repair.client';

const EMPTY_MISSION: RuntimeOperationalResponseDto = {
  overview: { missionId: 'm-1', runtimeTaskCount: 0, runningTaskCount: 0, failedTaskCount: 0, reviewPendingCount: 0, repairPendingCount: 0, retryPendingCount: 0 },
  actions: [],
  runtimeTasks: [],
  repairTasks: [],
};

const EMPTY_EVENTS: RuntimeEventsResponseDto = { runtime: [], repair: [] };

const POPULATED_MISSION: RuntimeOperationalResponseDto = {
  ...EMPTY_MISSION,
  repairTasks: [{ missionId: 'm-1', taskId: 'task-1', failureCategory: 'BUILD_FAILURE', failureCode: 'TS_COMPILE_ERROR', repairCompleted: false, nextAction: 'APPROVE_REPAIR' }],
};

const POPULATED_EVENTS: RuntimeEventsResponseDto = {
  runtime: [
    { id: 'e-1', missionId: 'm-1', version: 1, eventType: 'FAILURE_CLASSIFIED', aggregateType: 'FailureSnapshot', aggregateId: 'f-1', payload: { taskId: 'task-1', category: 'BUILD_FAILURE', failureCode: 'TS_COMPILE_ERROR' }, createdAt: 1000 },
    { id: 'e-2', missionId: 'm-1', version: 1, eventType: 'REPAIR_ADVISORY_CREATED', aggregateType: 'RepairAdvisory', aggregateId: 'a-1', payload: { taskId: 'task-1', specialistRole: 'DEVELOPER', risk: 'LOW' }, createdAt: 2000 },
    { id: 'e-3', missionId: 'm-1', version: 1, eventType: 'TEAM_COMPOSED', aggregateType: 'AgentTeam', aggregateId: 't-1', payload: {}, createdAt: 1500 },
  ],
  repair: [],
};

describe('MissionRepairComponent', () => {
  function setup(
    getMission: (missionId: string) => ReturnType<RuntimeClient['getMission']>,
    getEvents: (missionId: string) => ReturnType<RuntimeClient['getEvents']>,
    assessEligibility: (missionId: string, taskId: string, body: unknown) => ReturnType<RepairClient['assessEligibility']> = vi.fn()
  ) {
    TestBed.configureTestingModule({
      imports: [MissionRepairComponent],
      providers: [provideRouter([]), { provide: RuntimeClient, useValue: { getMission, getEvents } }, { provide: RepairClient, useValue: { assessEligibility } }],
    });
    const fixture = TestBed.createComponent(MissionRepairComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no repair tasks or events', async () => {
    const fixture = setup(
      () => of(EMPTY_MISSION),
      () => of(EMPTY_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('renders repair task cards and the filtered timeline', async () => {
    const fixture = setup(
      () => of(POPULATED_MISSION),
      () => of(POPULATED_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('task-1');
    expect(html).toContain('BUILD_FAILURE');
    expect(html).toContain('TS_COMPILE_ERROR');
    expect(html).toContain('APPROVE_REPAIR');
    expect(html).toContain('FAILURE_CLASSIFIED');
    expect(html).toContain('REPAIR_ADVISORY_CREATED');
    expect(html).not.toContain('TEAM_COMPOSED');
  });

  it('approves a repair pending approval and reloads', async () => {
    const decision: RepairEligibilityDecisionDto = { id: 'd-1', missionId: 'm-1', version: 1, taskId: 'task-1', attemptCount: 0, maxAttempts: 3, status: 'ELIGIBLE', reason: 'Repair is eligible under the current policy.', requiresApproval: true };
    const assessEligibility = vi.fn((_missionId: string, _taskId: string, _body: unknown) => of(decision));
    const fixture = setup(
      () => of(POPULATED_MISSION),
      () => of(EMPTY_EVENTS),
      assessEligibility
    );
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.approve('task-1');

    expect(assessEligibility).toHaveBeenCalledWith('m-1', 'task-1', { approvalGranted: true });
  });

  it('opens and closes the classify-failure dialog', async () => {
    const fixture = setup(
      () => of(EMPTY_MISSION),
      () => of(EMPTY_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogSelector = 'app-classify-failure-dialog';
    expect((fixture.nativeElement as HTMLElement).querySelector(dialogSelector)).toBeNull();

    fixture.componentInstance.openClassifyDialog();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector(dialogSelector)).not.toBeNull();

    fixture.componentInstance.onDialogClosed();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector(dialogSelector)).toBeNull();
  });
});
