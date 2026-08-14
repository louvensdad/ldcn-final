import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissionTeamComponent } from './mission-team';
import { AgentTeamDto, TeamClient } from '../../core/api/team.client';

const TEAM: AgentTeamDto = {
  id: 'team-1',
  missionId: 'm-1',
  version: 1,
  approvedSolutionId: 'sol-1',
  architectureCompositionId: 'arch-1',
  complexityProfile: 'LOW',
  riskProfile: 'LOW',
  status: 'APPROVED',
  instances: [
    { id: 'i-1', agentKey: 'architecture.nextjs.architect', role: 'ARCHITECT', stackKey: 'stack.typescript.nextjs', reason: 'Author of the approved proposal.' },
    { id: 'i-2', agentKey: 'fullstack.nextjs.lead', role: 'LEAD', stackKey: 'stack.typescript.nextjs', reason: 'Complexity LOW: Lead accumulates development.' },
  ],
  decisions: [
    { id: 'd-1', scope: 'stack.typescript.nextjs', problem: 'What minimal composition fits?', selectedOption: 'LOW tier: ARCHITECT, LEAD, TEST_ENGINEER', rationale: 'Derived from the LOW tier.', rulesApplied: [], decidedBy: 'team-composer.v2' },
  ],
};

describe('MissionTeamComponent', () => {
  function setup(get: (missionId: string) => ReturnType<TeamClient['get']>) {
    TestBed.configureTestingModule({
      imports: [MissionTeamComponent],
      providers: [provideRouter([]), { provide: TeamClient, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(MissionTeamComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  it('groups instances by stackKey', async () => {
    const fixture = setup((_missionId: string) => of(TEAM));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['groups']()).toEqual([{ stackKey: 'stack.typescript.nextjs', instances: TEAM.instances }]);
  });

  it('renders each instance role and agent key, collapsed by default', async () => {
    const fixture = setup((_missionId: string) => of(TEAM));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('ARCHITECT');
    expect(html).toContain('architecture.nextjs.architect');
    expect(html).not.toContain('Author of the approved proposal.');
  });

  it('expands the agent drawer on click, showing the reason and related decisions', async () => {
    const fixture = setup((_missionId: string) => of(TEAM));
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggleInstance('i-1');
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Author of the approved proposal.');
    expect(html).toContain('LOW tier: ARCHITECT, LEAD, TEST_ENGINEER');

    fixture.componentInstance.toggleInstance('i-1');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain('Author of the approved proposal.');
  });

  it('shows the empty state when there are no instances', async () => {
    const fixture = setup((_missionId: string) => of({ ...TEAM, instances: [] }));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
  });
});
