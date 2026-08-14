import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MissionDetailComponent } from './mission-detail';
import { MissionClient, MissionOverviewDto } from '../../core/api/mission.client';
import { EventStreamService, FrontendEvent } from '../../core/sse/event-stream.service';

const OVERVIEW: MissionOverviewDto = {
  missionId: 'm-1',
  currentOperation: null,
  intentSummary: { rawUserIdea: 'quero uma landing page', problemStatement: 'Atender uma necessidade digital do usuário.', confidence: 0.8, status: 'READY' },
  requirementsSummary: { itemCount: 4, status: 'APPROVED' },
  topologySummary: { requiredTargets: ['FRONTEND'], status: 'APPROVED' },
  solutionSummary: { selectedStackCount: 1, deliveryTargetCount: 1, status: 'ACTIVE' },
  architectureSummary: { proposalCount: 1, conflictCount: 0, status: 'APPROVED' },
  teamSummary: { instanceCount: 3, status: 'APPROVED' },
  pipelineSummary: { nodeCount: 6, blockedNodeCount: 0, status: 'APPROVED' },
  taskSummary: null,
  artifactSummary: null,
  reviewSummary: null,
  gateSummary: null,
  aiUsageSummary: null,
  costSummary: null,
  nextAction: 'START_EXECUTION',
  blockers: [],
};

// overviewResource is `protected`; bracket notation reads it the same way other specs in this
// app already do.
describe('MissionDetailComponent', () => {
  function setup(getOverview: (missionId: string) => ReturnType<MissionClient['getOverview']>) {
    const events = new Subject<FrontendEvent>();
    TestBed.configureTestingModule({
      imports: [MissionDetailComponent],
      providers: [
        provideRouter([]),
        { provide: MissionClient, useValue: { getOverview } },
        { provide: EventStreamService, useValue: { events$: events.asObservable() } },
      ],
    });
    const fixture = TestBed.createComponent(MissionDetailComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return { fixture, events };
  }

  it('loads the overview for the missionId bound from the route', async () => {
    const getOverview = vi.fn((_missionId: string) => of(OVERVIEW));
    const { fixture } = setup(getOverview);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getOverview).toHaveBeenCalledWith('m-1');
    expect(fixture.componentInstance['overviewResource'].value()).toEqual(OVERVIEW);
  });

  it('reloads when a relevant SSE event arrives for this mission', async () => {
    const getOverview = vi.fn((_missionId: string) => of(OVERVIEW));
    const { fixture, events } = setup(getOverview);
    await fixture.whenStable();
    getOverview.mockClear();

    events.next({ id: 'e-1', type: 'pipeline.updated', occurredAt: new Date().toISOString(), missionId: 'm-1', payload: {} });
    await fixture.whenStable();

    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it('ignores SSE events for a different mission', async () => {
    const getOverview = vi.fn((_missionId: string) => of(OVERVIEW));
    const { fixture, events } = setup(getOverview);
    await fixture.whenStable();
    getOverview.mockClear();

    events.next({ id: 'e-1', type: 'pipeline.updated', occurredAt: new Date().toISOString(), missionId: 'other-mission', payload: {} });
    await fixture.whenStable();

    expect(getOverview).not.toHaveBeenCalled();
  });

  it('ignores SSE event types that do not affect the overview', async () => {
    const getOverview = vi.fn((_missionId: string) => of(OVERVIEW));
    const { fixture, events } = setup(getOverview);
    await fixture.whenStable();
    getOverview.mockClear();

    events.next({ id: 'e-1', type: 'operation.started', occurredAt: new Date().toISOString(), missionId: 'm-1', payload: {} });
    await fixture.whenStable();

    expect(getOverview).not.toHaveBeenCalled();
  });
});
