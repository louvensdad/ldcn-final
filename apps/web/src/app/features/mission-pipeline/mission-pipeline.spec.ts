import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionPipelineComponent } from './mission-pipeline';
import { MissionPipelinePlanDto, PipelineClient, PipelineNodeDto } from '../../core/api/pipeline.client';

function node(overrides: Partial<PipelineNodeDto>): PipelineNodeDto {
  return {
    id: overrides.key ?? 'n',
    key: 'n',
    type: 'GENERATION',
    stackKey: 'stack.typescript.nextjs',
    required: true,
    dependsOn: [],
    ownerRole: 'LEAD',
    contractRefs: [],
    gateRefs: [],
    state: 'PENDING',
    ...overrides,
  };
}

const PLAN: MissionPipelinePlanDto = {
  id: 'plan-1',
  missionId: 'm-1',
  version: 1,
  status: 'APPROVED',
  dependencies: [],
  nodes: [
    node({ key: 'nextjs.gate', type: 'GATE' }),
    node({ key: 'nextjs.generation', type: 'GENERATION' }),
    node({ key: 'nextjs.build', type: 'BUILD' }),
  ],
};

describe('MissionPipelineComponent', () => {
  function setup(get: (missionId: string) => ReturnType<PipelineClient['get']>) {
    TestBed.configureTestingModule({
      imports: [MissionPipelineComponent],
      providers: [provideRouter([]), { provide: PipelineClient, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(MissionPipelineComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('groups nodes by stackKey and orders them by pipeline stage regardless of API order', async () => {
    const fixture = setup((_missionId: string) => of(PLAN));
    await fixture.whenStable();
    fixture.detectChanges();

    const groups = fixture.componentInstance['groups']();
    expect(groups).toHaveLength(1);
    expect(groups[0].stackKey).toBe('stack.typescript.nextjs');
    expect(groups[0].nodes.map((n) => n.type)).toEqual(['GENERATION', 'BUILD', 'GATE']);
  });

  it('shows the blocked reason for unsupported-runtime nodes', async () => {
    const blockedPlan: MissionPipelinePlanDto = { ...PLAN, nodes: [node({ key: 'x', type: 'BUILD', state: 'BLOCKED_UNSUPPORTED_RUNTIME', blockedReason: 'Runtime sem suporte para stack.x' })] };
    const fixture = setup((_missionId: string) => of(blockedPlan));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Runtime sem suporte para stack.x');
  });

  it('shows the empty state when there are no nodes', async () => {
    const fixture = setup((_missionId: string) => of({ ...PLAN, nodes: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });
});
