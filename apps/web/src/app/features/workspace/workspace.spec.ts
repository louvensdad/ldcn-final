import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { WorkspaceComponent } from './workspace';
import { MissionClient, MissionSummaryDto } from '../../core/api/mission.client';

describe('WorkspaceComponent', () => {
  function setup(missions: MissionSummaryDto[]) {
    TestBed.configureTestingModule({
      imports: [WorkspaceComponent],
      providers: [provideRouter([]), { provide: MissionClient, useValue: { list: () => of(missions) } }],
    });
    return TestBed.createComponent(WorkspaceComponent);
  }

  it('renders the empty state when there are no missions', async () => {
    const fixture = setup([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-empty-state');
    expect(fixture.nativeElement.querySelectorAll('.workspace__item')).toHaveLength(0);
  });

  it('renders one item per mission returned by the API', async () => {
    const fixture = setup([
      { missionId: 'm-1', rawUserIdea: 'quero uma landing page', nextAction: 'START_EXECUTION', blockers: [], updatedAt: new Date().toISOString(), generatorState: 'READY_FOR_EXECUTION' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.workspace__item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('quero uma landing page');
  });

  it('createMission() navigates to the wizard', async () => {
    const fixture = setup([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    fixture.componentInstance.createMission();
    expect(navigateSpy).toHaveBeenCalledWith('/wizard');
  });
});
