import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskDetailComponent } from './task-detail';
import { JobClassificationDto, TaskClient, TaskOverviewDto, WorkRoutingDecisionDto } from '../../core/api/task.client';
import { GateClient, ReviewGateEvaluationDto } from '../../core/api/gate.client';

const CLASSIFICATION: JobClassificationDto = {
  id: 'c-1',
  missionId: 'm-1',
  taskId: 't-1',
  jobType: 'FRONTEND_IMPLEMENTATION',
  affectedStacks: ['stack.typescript.nextjs'],
  affectedDomains: [],
  complexity: 'LOW',
  riskLevel: 'LOW',
  requiredCapabilities: ['frontend_implementation'],
  requiresArchitectureReview: false,
  requiresSecurityReview: false,
  requiresDataSpecialist: false,
  requiresRuntimeSpecialist: false,
  requiresIntegration: false,
  scopeExpansionRequired: false,
  contextHash: 'hash',
};

const ROUTING: WorkRoutingDecisionDto = {
  id: 'r-1',
  missionId: 'm-1',
  version: 1,
  taskId: 't-1',
  approvedSolutionId: 'sol-1',
  jobClassificationId: 'c-1',
  selectedAgentInstanceIds: [],
  reviewerCandidateIds: [],
  selectedReviewerIds: [],
  requiredSpecialists: [],
  requiredCapabilityKeys: ['frontend_implementation'],
  requiredGateKeys: ['review', 'quality'],
  routingSource: 'DETERMINISTIC',
  confidence: 1,
  rationale: 'Job routed to the smallest capable set, with an independent reviewer.',
  contextHash: 'hash',
  status: 'ROUTED',
};

describe('TaskDetailComponent', () => {
  function setup(taskClient: Partial<TaskClient>, gateClient: Partial<GateClient> = { evaluate: vi.fn() }) {
    TestBed.configureTestingModule({
      imports: [TaskDetailComponent],
      providers: [provideRouter([]), { provide: TaskClient, useValue: taskClient }, { provide: GateClient, useValue: gateClient }],
    });
    const fixture = TestBed.createComponent(TaskDetailComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.componentRef.setInput('taskId', 't-1');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the classification and a "route" button when not routed yet', async () => {
    const overview: TaskOverviewDto = { classification: CLASSIFICATION };
    const fixture = setup({ getOverview: (_missionId: string, _taskId: string) => of(overview) });
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('FRONTEND_IMPLEMENTATION');
    expect(html).not.toContain('routed to the smallest capable set');
  });

  it('shows the routing explanation (rationale) once routed', async () => {
    const overview: TaskOverviewDto = { classification: CLASSIFICATION, routing: ROUTING };
    const fixture = setup({ getOverview: (_missionId: string, _taskId: string) => of(overview) });
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('ROUTED');
    expect(html).toContain('routed to the smallest capable set');
  });

  it('route() reloads the overview after a successful routing call', async () => {
    const getOverview = vi.fn((_missionId: string, _taskId: string) => of({ classification: CLASSIFICATION } as TaskOverviewDto));
    const route = vi.fn((_missionId: string, _taskId: string) => of(ROUTING));
    const fixture = setup({ getOverview, route });
    await fixture.whenStable();
    fixture.detectChanges();
    getOverview.mockClear();

    fixture.componentInstance.route();
    await fixture.whenStable();

    expect(route).toHaveBeenCalledWith('m-1', 't-1');
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it('shows the gate evaluation form when the task is ROUTED', async () => {
    const overview: TaskOverviewDto = { classification: CLASSIFICATION, routing: ROUTING };
    const fixture = setup({ getOverview: (_missionId: string, _taskId: string) => of(overview) });
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('review');
    expect(html).toContain('quality');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.task-detail__gate-row')).toHaveLength(2);
  });

  it('hides the gate evaluation form and shows the not-ready note when not ROUTED', async () => {
    const blocked: WorkRoutingDecisionDto = { ...ROUTING, status: 'BLOCKED_NO_REVIEWER' };
    const overview: TaskOverviewDto = { classification: CLASSIFICATION, routing: blocked };
    const fixture = setup({ getOverview: (_missionId: string, _taskId: string) => of(overview) });
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('task-detail__gate-row');
    expect(html).toContain('task-detail__gates-not-ready');
  });

  it('evaluateGates submits evidence for every required gate and renders the result', async () => {
    const overview: TaskOverviewDto = { classification: CLASSIFICATION, routing: ROUTING };
    const evaluation: ReviewGateEvaluationDto = {
      id: 'ev-1', missionId: 'm-1', version: 1, taskId: 't-1', routingDecisionId: 'r-1',
      requiredGateKeys: ['review', 'quality'], evaluatedGateKeys: ['review', 'quality'],
      missingGateKeys: [], failedGateKeys: [], duplicateGateKeys: [], unauthorizedReviewerAgentIds: [], unexpectedGateKeys: [],
      evidenceRefs: ['pr-1'], status: 'PASSED', reason: 'All required gates passed.', evidenceHash: 'hash',
    };
    const evaluate = vi.fn((_missionId: string, _taskId: string, _evidence: unknown) => of(evaluation));
    const fixture = setup({ getOverview: (_missionId: string, _taskId: string) => of(overview) }, { evaluate });
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.setGatePassed('review', true);
    fixture.componentInstance.setGatePassed('quality', true);
    fixture.componentInstance.evaluateGates(['review', 'quality']);
    fixture.detectChanges();

    expect(evaluate).toHaveBeenCalledWith('m-1', 't-1', [
      { gateKey: 'review', passed: true, evidenceRefs: [] },
      { gateKey: 'quality', passed: true, evidenceRefs: [] },
    ]);
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('PASSED');
    expect(html).toContain('All required gates passed.');
  });
});
