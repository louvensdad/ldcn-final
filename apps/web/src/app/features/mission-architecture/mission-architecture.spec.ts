import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MissionArchitectureComponent } from './mission-architecture';
import { ArchitectureClient, ArchitectureCompositionDto } from '../../core/api/architecture.client';
import { AssistantClient, ExplainDecisionResponseDto } from '../../core/api/assistant.client';
import { AppError } from '../../core/errors/error-mapper';

const COMPOSITION: ArchitectureCompositionDto = {
  id: 'arch-1',
  missionId: 'm-1',
  version: 1,
  approvedSolutionId: 'sol-1',
  status: 'APPROVED',
  conflicts: [],
  proposals: [
    {
      id: 'prop-1',
      stackKey: 'stack.typescript.nextjs',
      deliveryTargetKind: 'FRONTEND',
      architectureStyle: 'fullstack-single-runtime',
      modules: [{ name: 'pages', responsibility: 'Render UI', exposes: [], dependsOn: [] }],
      boundaries: [],
      dependencies: [],
      security: [],
      communication: [],
      observability: [],
      buildStrategy: 'Single build',
      testStrategy: 'Component tests',
      deploymentStrategy: 'Serverless',
      alternatives: [],
      tradeoffs: [],
      risks: [],
      status: 'APPROVED',
      decisions: [
        {
          id: 'dec-1',
          scope: 'stack.typescript.nextjs',
          problem: 'Which architecture style fits?',
          optionsConsidered: ['fullstack-single-runtime'],
          selectedOption: 'Full-stack Single Runtime',
          rationale: 'Selected based on the approved stack and requirements.',
          constraints: [],
          tradeoffs: ['Fast time-to-market'],
          decidedBy: 'architecture.nextjs.architect',
          reviewedBy: [],
          status: 'APPROVED',
        },
      ],
    },
  ],
};

describe('MissionArchitectureComponent', () => {
  function setup(get: (missionId: string) => ReturnType<ArchitectureClient['get']>, explainArchitectureDecision: AssistantClient['explainArchitectureDecision'] = vi.fn()) {
    TestBed.configureTestingModule({
      imports: [MissionArchitectureComponent],
      providers: [provideRouter([]), { provide: ArchitectureClient, useValue: { get } }, { provide: AssistantClient, useValue: { explainArchitectureDecision } }],
    });
    const fixture = TestBed.createComponent(MissionArchitectureComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('renders a proposal card with its modules and decisions', async () => {
    const fixture = setup((_missionId: string) => of(COMPOSITION));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('stack.typescript.nextjs');
    expect(html).toContain('fullstack-single-runtime');
    expect(html).toContain('Full-stack Single Runtime');
    expect(html).toContain('Fast time-to-market');
  });

  it('renders a conflicts banner when there are conflicts', async () => {
    const withConflict: ArchitectureCompositionDto = {
      ...COMPOSITION,
      conflicts: [{ id: 'c-1', severity: 'CRITICAL', topic: 'Ownership', description: 'Two architects claim the same module.', involvedStacks: ['stack.a', 'stack.b'] }],
    };
    const fixture = setup((_missionId: string) => of(withConflict));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Ownership');
    expect(html).toContain('Two architects claim the same module.');
  });

  it('shows the empty state when there are no proposals', async () => {
    const fixture = setup((_missionId: string) => of({ ...COMPOSITION, proposals: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });

  it('explains a decision on demand and shows the explanation with usage metadata', async () => {
    const response: ExplainDecisionResponseDto = {
      explanation: 'Essa arquitetura foi escolhida porque é a mais simples para o time atual.',
      usage: { provider: 'deepseek', model: 'deepseek-chat', promptTokens: 100, completionTokens: 30, totalTokens: 130, latencyMs: 900 },
    };
    const explainArchitectureDecision = vi.fn((_missionId: string, _decisionId: string) => of(response));
    const fixture = setup((_missionId: string) => of(COMPOSITION), explainArchitectureDecision);
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(explainArchitectureDecision).toHaveBeenCalledWith('m-1', 'dec-1');
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('mais simples para o time atual');
    expect(html).toContain('deepseek-chat');
    expect(html).toContain('130 tokens');
  });

  it('shows a retryable error state when the explanation call fails', async () => {
    const appError: AppError = { category: 'SERVER', status: 503, code: 'AI_EXPLANATION_UNAVAILABLE', translationKey: 'errors.5xx' };
    const explainArchitectureDecision = vi.fn((_missionId: string, _decisionId: string) => throwError(() => appError));
    const fixture = setup((_missionId: string) => of(COMPOSITION), explainArchitectureDecision);
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-error-state');
  });
});
