import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionGatesComponent } from './mission-gates';
import { RuntimeClient, RuntimeEventsResponseDto } from '../../core/api/runtime.client';

const EMPTY_EVENTS: RuntimeEventsResponseDto = { runtime: [], repair: [] };

const POPULATED_EVENTS: RuntimeEventsResponseDto = {
  runtime: [
    { id: 'e-1', missionId: 'm-1', version: 1, eventType: 'GATE_EVALUATED', aggregateType: 'ReviewGateEvaluation', aggregateId: 'g-1', payload: { taskId: 'task-1', status: 'PASSED', evaluatedGateCount: 2, failedGateCount: 0 }, createdAt: 1000 },
    { id: 'e-2', missionId: 'm-1', version: 1, eventType: 'REVIEW_COMPLETED', aggregateType: 'ReviewGateEvaluation', aggregateId: 'g-2', payload: { taskId: 'task-1', status: 'FAILED', failedGateCount: 1 }, createdAt: 2000 },
    { id: 'e-3', missionId: 'm-1', version: 1, eventType: 'INTENT_ANALYZED', aggregateType: 'ProjectIntent', aggregateId: 'i-1', payload: {}, createdAt: 500 },
  ],
  repair: [],
};

describe('MissionGatesComponent', () => {
  function setup(getEvents: (missionId: string) => ReturnType<RuntimeClient['getEvents']>) {
    TestBed.configureTestingModule({
      imports: [MissionGatesComponent],
      providers: [provideRouter([]), { provide: RuntimeClient, useValue: { getEvents } }],
    });
    const fixture = TestBed.createComponent(MissionGatesComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there are no gate/review events', async () => {
    const fixture = setup(() => of(EMPTY_EVENTS));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('renders passed/failed counts and the timeline, ignoring unrelated event types', async () => {
    const fixture = setup(() => of(POPULATED_EVENTS));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('GATE_EVALUATED');
    expect(html).toContain('REVIEW_COMPLETED');
    expect(html).not.toContain('INTENT_ANALYZED');

    const statValues = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.mission-gates__stat-value')).map((el) => el.textContent?.trim());
    expect(statValues).toEqual(['1', '1', '0']);
  });
});
