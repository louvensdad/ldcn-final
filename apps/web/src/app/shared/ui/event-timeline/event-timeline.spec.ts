import { TestBed } from '@angular/core/testing';
import { EventTimelineComponent } from './event-timeline';
import { DecisionEventDto } from '../../../core/api/runtime.client';

const EVENTS: DecisionEventDto[] = [
  { id: 'e-1', missionId: 'm-1', version: 1, eventType: 'GATE_EVALUATED', aggregateType: 'ReviewGateEvaluation', aggregateId: 'g-1', payload: { taskId: 'task-1', status: 'PASSED', evaluatedGateCount: 2, failedGateCount: 0 }, createdAt: 1000 },
  { id: 'e-2', missionId: 'm-1', version: 1, eventType: 'REVIEW_COMPLETED', aggregateType: 'ReviewGateEvaluation', aggregateId: 'g-2', payload: { taskId: 'task-1', status: 'FAILED', failedGateCount: 1 }, createdAt: 2000 },
];

describe('EventTimelineComponent', () => {
  function setup(events: DecisionEventDto[]) {
    const fixture = TestBed.createComponent(EventTimelineComponent);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each event type and its payload entries', () => {
    const fixture = setup(EVENTS);
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('GATE_EVALUATED');
    expect(html).toContain('status: PASSED');
    expect(html).toContain('REVIEW_COMPLETED');
    expect(html).toContain('failedGateCount: 1');
  });

  it('renders nothing when there are no events', () => {
    const fixture = setup([]);
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html.trim()).toBe('');
  });
});
