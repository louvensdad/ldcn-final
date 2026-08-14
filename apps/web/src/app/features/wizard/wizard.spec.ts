import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WizardComponent } from './wizard';
import { GeneratorClient, StartMissionAcceptedDto, StartMissionRequest } from '../../core/api/generator.client';
import { MissionClient, MissionOverviewDto } from '../../core/api/mission.client';
import { AppError } from '../../core/errors/error-mapper';

const OVERVIEW: MissionOverviewDto = {
  missionId: 'ignored-in-test',
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

// step()/overview()/error()/submitting()/form are `protected` on WizardComponent; bracket
// notation reads them from the test the same way workspace.spec.ts already does.
describe('WizardComponent', () => {
  function setup(start: GeneratorClient['start']) {
    TestBed.configureTestingModule({
      imports: [WizardComponent],
      providers: [
        provideRouter([]),
        { provide: GeneratorClient, useValue: { start } },
        { provide: MissionClient, useValue: { getOverview: () => of(OVERVIEW) } },
      ],
    });
    const fixture = TestBed.createComponent(WizardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('starts on the form step', () => {
    const fixture = setup(() => of({} as StartMissionAcceptedDto));
    expect(fixture.componentInstance['step']()).toBe('form');
  });

  it('submits the idea and moves to the recap step on success', async () => {
    const start = vi.fn((_missionId: string, _request: StartMissionRequest) => of({ operationId: 'op-1', missionId: 'm-1', status: 'SUCCEEDED' } as StartMissionAcceptedDto));
    const fixture = setup(start);

    fixture.componentInstance['form'].controls.rawUserIdea.setValue('quero uma landing page');
    fixture.componentInstance.submit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toMatchObject({ rawUserIdea: 'quero uma landing page' });
    expect(fixture.componentInstance['step']()).toBe('recap');
    expect(fixture.componentInstance['overview']()).toEqual(OVERVIEW);
  });

  it('does not submit when the idea is empty', () => {
    const start = vi.fn(() => of({} as StartMissionAcceptedDto));
    const fixture = setup(start);
    fixture.componentInstance.submit();
    expect(start).not.toHaveBeenCalled();
  });

  it('shows the mapped error and stays on the form when start() fails', async () => {
    const error: AppError = { category: 'CONFLICT', status: 409, code: 'GENERATOR_COMMAND_CONFLICT', translationKey: 'errors.409' };
    const fixture = setup(() => throwError(() => error));

    fixture.componentInstance['form'].controls.rawUserIdea.setValue('quero uma landing page');
    fixture.componentInstance.submit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['step']()).toBe('form');
    expect(fixture.componentInstance['error']()).toEqual(error);
    expect(fixture.componentInstance['submitting']()).toBe(false);
  });

  it('collects comma-separated technology preferences and toggled forbidden targets', async () => {
    const start = vi.fn((_missionId: string, _request: StartMissionRequest) => of({ operationId: 'op-1', missionId: 'm-1', status: 'SUCCEEDED' } as StartMissionAcceptedDto));
    const fixture = setup(start);

    fixture.componentInstance['form'].controls.rawUserIdea.setValue('quero uma landing page');
    fixture.componentInstance['form'].controls.technologyPreferences.setValue('astro, next.js');
    fixture.componentInstance.toggleTarget('MOBILE');
    fixture.componentInstance.submit();
    await fixture.whenStable();

    const request = start.mock.calls[0][1] as StartMissionRequest;
    expect(request.technologyPreferences).toEqual(['astro', 'next.js']);
    expect(request.forbiddenDeliveryTargets).toEqual(['MOBILE']);
  });
});
