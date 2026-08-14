import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionExecutionComponent } from './mission-execution';
import { RuntimeClient, RuntimeEventsResponseDto, RuntimeOperationalResponseDto } from '../../core/api/runtime.client';

const EMPTY_RESPONSE: RuntimeOperationalResponseDto = {
  overview: {
    missionId: 'm-1',
    runtimeTaskCount: 0,
    runningTaskCount: 0,
    failedTaskCount: 0,
    reviewPendingCount: 0,
    repairPendingCount: 0,
    retryPendingCount: 0,
  },
  actions: [],
  runtimeTasks: [],
  repairTasks: [],
};

const EMPTY_EVENTS: RuntimeEventsResponseDto = { runtime: [], repair: [] };

const POPULATED_RESPONSE: RuntimeOperationalResponseDto = {
  overview: {
    missionId: 'm-1',
    runtimeTaskCount: 2,
    runningTaskCount: 1,
    failedTaskCount: 1,
    reviewPendingCount: 1,
    repairPendingCount: 0,
    retryPendingCount: 0,
  },
  actions: [{ missionId: 'm-1', taskId: 'task-1', action: 'REVIEW', source: 'RUNTIME' }],
  runtimeTasks: [
    { missionId: 'm-1', taskId: 'task-1', executionStatus: 'DISPATCHED', attemptCount: 1, advisoryCount: 0, outcomeCount: 0, nextAction: 'REVIEW' },
    { missionId: 'm-1', taskId: 'task-2', executionStatus: 'FAILED', attemptCount: 2, lastGateStatus: 'FAILED', advisoryCount: 1, outcomeCount: 0, nextAction: 'REPAIR_ADVISORY' },
  ],
  repairTasks: [],
};

const POPULATED_EVENTS: RuntimeEventsResponseDto = {
  runtime: [
    { id: 'e-1', missionId: 'm-1', version: 1, eventType: 'EXECUTION_DISPATCHED', aggregateType: 'RuntimeTask', aggregateId: 'task-1', payload: { taskId: 'task-1' }, createdAt: 1000 },
    { id: 'e-2', missionId: 'm-1', version: 1, eventType: 'EXECUTION_FAILED', aggregateType: 'RuntimeTask', aggregateId: 'task-2', payload: { taskId: 'task-2', errorCode: 'BUILD_FAILED' }, createdAt: 2000 },
  ],
  repair: [],
};

describe('MissionExecutionComponent', () => {
  function setup(
    getMission: (missionId: string) => ReturnType<RuntimeClient['getMission']>,
    getEvents: (missionId: string) => ReturnType<RuntimeClient['getEvents']>
  ) {
    TestBed.configureTestingModule({
      imports: [MissionExecutionComponent],
      providers: [provideRouter([]), { provide: RuntimeClient, useValue: { getMission, getEvents } }],
    });
    const fixture = TestBed.createComponent(MissionExecutionComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no runtime tasks or actions', async () => {
    const fixture = setup(
      () => of(EMPTY_RESPONSE),
      () => of(EMPTY_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('renders summary counts, actions and runtime tasks', async () => {
    const fixture = setup(
      () => of(POPULATED_RESPONSE),
      () => of(EMPTY_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('task-1');
    expect(html).toContain('REVIEW');
    expect(html).toContain('task-2');
    expect(html).toContain('FAILED');
    expect(html).toContain('REPAIR_ADVISORY');
  });

  it('renders the event timeline sorted newest first', async () => {
    const fixture = setup(
      () => of(POPULATED_RESPONSE),
      () => of(POPULATED_EVENTS)
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    const dispatchedIndex = html.indexOf('EXECUTION_DISPATCHED');
    const failedIndex = html.indexOf('EXECUTION_FAILED');
    expect(failedIndex).toBeGreaterThan(-1);
    expect(dispatchedIndex).toBeGreaterThan(-1);
    expect(failedIndex).toBeLessThan(dispatchedIndex);
    expect(html).toContain('BUILD_FAILED');
  });
});
