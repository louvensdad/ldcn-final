import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CommandPaletteComponent } from './command-palette';
import { CommandPaletteService } from '../../core/command-palette/command-palette.service';
import { MissionClient, MissionSummaryDto } from '../../core/api/mission.client';
import { AuthService } from '../../core/auth/auth.service';

const MISSIONS: MissionSummaryDto[] = [
  { missionId: 'm-1', rawUserIdea: 'quero uma landing page', nextAction: 'START_EXECUTION', blockers: [], updatedAt: new Date().toISOString() },
  { missionId: 'm-2', rawUserIdea: 'checkout de e-commerce', nextAction: 'START_EXECUTION', blockers: [], updatedAt: new Date().toISOString() },
];

describe('CommandPaletteComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [provideRouter([]), { provide: MissionClient, useValue: { list: () => of(MISSIONS) } }, { provide: AuthService, useValue: { signOut: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    return fixture;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function ctrlK(): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
  }

  it('opens with Ctrl+K even while an unrelated input has focus, and closes with Escape', async () => {
    const fixture = setup();
    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    fixture.componentInstance.onGlobalKeydown(ctrlK());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeTruthy();

    const paletteService = TestBed.inject(CommandPaletteService);
    expect(paletteService.isOpen()).toBe(true);

    fixture.componentInstance.onGlobalKeydown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(paletteService.isOpen()).toBe(false);
    expect(document.activeElement).toBe(outsideInput);
  });

  it('filters missions and navigation by the typed query', async () => {
    const fixture = setup();
    fixture.componentInstance.onGlobalKeydown(ctrlK());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('.palette__input') as HTMLInputElement;
    input.value = 'checkout';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('checkout de e-commerce');
    expect(html).not.toContain('quero uma landing page');
  });

  it('navigates and closes when a result is activated with Enter', async () => {
    const fixture = setup();
    fixture.componentInstance.onGlobalKeydown(ctrlK());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('.palette__input') as HTMLInputElement;
    input.value = 'checkout';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const paletteService = TestBed.inject(CommandPaletteService);

    fixture.componentInstance.onGlobalKeydown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(navigateSpy).toHaveBeenCalledWith(['/missions', 'm-2']);
    expect(paletteService.isOpen()).toBe(false);
  });
});
