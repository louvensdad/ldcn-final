import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionAiUsageComponent } from './mission-ai-usage';
import { RuntimeClient, RuntimeEventsResponseDto } from '../../core/api/runtime.client';

const EMPTY_EVENTS: RuntimeEventsResponseDto = { runtime: [], repair: [] };

const POPULATED_EVENTS: RuntimeEventsResponseDto = {
  runtime: [
    { id: 'e-1', missionId: 'm-1', version: 1, eventType: 'AI_EXPLANATION_GENERATED', aggregateType: 'ArchitectureDecision', aggregateId: 'a-1', payload: { aggregateType: 'ArchitectureDecision', aggregateId: 'a-1', provider: 'deepseek', model: 'deepseek-chat', promptUnits: 100, completionUnits: 40, totalUnits: 140, latencyMs: 1000 }, createdAt: 1000 },
    { id: 'e-2', missionId: 'm-1', version: 1, eventType: 'AI_EXPLANATION_GENERATED', aggregateType: 'TeamCompositionDecision', aggregateId: 't-1', payload: { aggregateType: 'TeamCompositionDecision', aggregateId: 't-1', provider: 'deepseek', model: 'deepseek-chat', promptUnits: 200, completionUnits: 60, totalUnits: 260, latencyMs: 2000 }, createdAt: 2000 },
    { id: 'e-3', missionId: 'm-1', version: 1, eventType: 'TEAM_COMPOSED', aggregateType: 'AgentTeam', aggregateId: 'x-1', payload: {}, createdAt: 1500 },
  ],
  repair: [],
};

describe('MissionAiUsageComponent', () => {
  function setup(getEvents: (missionId: string) => ReturnType<RuntimeClient['getEvents']>) {
    TestBed.configureTestingModule({
      imports: [MissionAiUsageComponent],
      providers: [provideRouter([]), { provide: RuntimeClient, useValue: { getEvents } }],
    });
    const fixture = TestBed.createComponent(MissionAiUsageComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state when there is no AI usage yet', async () => {
    const fixture = setup(() => of(EMPTY_EVENTS));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('computes summary stats and ignores unrelated event types', async () => {
    const fixture = setup(() => of(POPULATED_EVENTS));
    await fixture.whenStable();
    fixture.detectChanges();

    const statValues = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.mission-ai-usage__stat-value')).map((el) => el.textContent?.trim());
    expect(statValues).toEqual(['2', '400', '1500ms']);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('ArchitectureDecision');
    expect(html).toContain('TeamCompositionDecision');
    expect(html).not.toContain('TEAM_COMPOSED');
  });
});
