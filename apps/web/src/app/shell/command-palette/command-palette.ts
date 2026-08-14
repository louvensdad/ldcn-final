import { Component, ElementRef, computed, effect, inject, resource, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommandPaletteService } from '../../core/command-palette/command-palette.service';
import { MissionClient } from '../../core/api/mission.client';
import { ThemeService } from '../../core/theme/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AuthService } from '../../core/auth/auth.service';

interface PaletteResult {
  id: string;
  group: 'missions' | 'navigation' | 'actions';
  label: string;
  sublabel?: string;
  action: () => void;
}

/** Sub-routes of the current mission (mirrors shared/ui/mission-nav/mission-nav.html's tabs). */
const MISSION_TABS: { path: string; labelKey: string }[] = [
  { path: '', labelKey: 'missionNav.overview' },
  { path: 'architecture', labelKey: 'missionNav.architecture' },
  { path: 'team', labelKey: 'missionNav.team' },
  { path: 'pipeline', labelKey: 'missionNav.pipeline' },
  { path: 'tasks', labelKey: 'missionNav.tasks' },
  { path: 'execution', labelKey: 'missionNav.execution' },
  { path: 'gates', labelKey: 'missionNav.gates' },
  { path: 'repair', labelKey: 'missionNav.repair' },
];

/**
 * doc 44 F10 / doc 47 (scoped down — see the F10 command-palette plan for what's deliberately
 * out: favorites, recent items, search operators, permission-aware results, workspace switcher,
 * backend search indexing — none of that exists in this app yet). Searches only what's real:
 * missions (MissionClient.list()), static + current-mission navigation, and the handful of
 * actions the Topbar already exposes (theme, sign out).
 *
 * Always mounted in AppShellComponent so the Ctrl/Cmd+K listener works from any screen, including
 * with focus inside a text field — same convention as GitHub/Linear/Slack.
 */
@Component({
  selector: 'app-command-palette',
  imports: [TranslatePipe],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPaletteComponent {
  protected readonly paletteService = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly missionClient = inject(MissionClient);
  private readonly theme = inject(ThemeService);
  private readonly translation = inject(TranslationService);
  private readonly auth = inject(AuthService);

  private readonly paletteRef = viewChild<ElementRef<HTMLElement>>('paletteRef');

  protected readonly query = signal('');
  protected readonly highlightedIndex = signal(0);

  private readonly missionsResource = resource({
    params: () => (this.paletteService.isOpen() ? true : undefined),
    loader: () => firstValueFrom(this.missionClient.list()),
  });

  private readonly currentMissionId = computed(() => {
    const match = /^\/missions\/([^/]+)/.exec(this.router.url);
    return match ? match[1] : null;
  });

  protected readonly results = computed<PaletteResult[]>(() => {
    const query = this.query().trim().toLowerCase();
    const matches = (label: string) => !query || label.toLowerCase().includes(query);
    const results: PaletteResult[] = [];

    const navItems: { label: string; route: string[] }[] = [
      { label: this.translation.translate('commandPalette.goToWorkspace'), route: ['/'] },
      { label: this.translation.translate('commandPalette.newMission'), route: ['/wizard'] },
    ];
    const missionId = this.currentMissionId();
    if (missionId) {
      for (const tab of MISSION_TABS) {
        navItems.push({
          label: this.translation.translate(tab.labelKey),
          route: tab.path ? ['/missions', missionId, tab.path] : ['/missions', missionId],
        });
      }
    }
    for (const item of navItems) {
      if (matches(item.label)) results.push({ id: `nav:${item.route.join('/')}`, group: 'navigation', label: item.label, action: () => this.navigate(item.route) });
    }

    for (const mission of this.missionsResource.value() ?? []) {
      if (matches(`${mission.rawUserIdea} ${mission.missionId}`)) {
        results.push({ id: `mission:${mission.missionId}`, group: 'missions', label: mission.rawUserIdea, sublabel: mission.missionId, action: () => this.navigate(['/missions', mission.missionId]) });
      }
    }

    const actions: { label: string; run: () => void }[] = [
      { label: this.translation.translate('commandPalette.toggleTheme'), run: () => this.theme.toggle() },
      { label: this.translation.translate('commandPalette.signOut'), run: () => this.auth.signOut() },
    ];
    for (const action of actions) {
      if (matches(action.label)) results.push({ id: `action:${action.label}`, group: 'actions', label: action.label, action: () => this.runAction(action.run) });
    }

    return results;
  });

  constructor() {
    effect(() => {
      if (this.paletteService.isOpen()) {
        this.query.set('');
        this.highlightedIndex.set(0);
      }
    });
  }

  protected groupLabelKey(group: PaletteResult['group']): string {
    if (group === 'missions') return 'commandPalette.groupMissions';
    if (group === 'navigation') return 'commandPalette.groupNavigation';
    return 'commandPalette.groupActions';
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.highlightedIndex.set(0);
  }

  protected activateHighlighted(): void {
    this.results()[this.highlightedIndex()]?.action();
  }

  private moveHighlight(delta: number): void {
    const length = this.results().length;
    if (length === 0) return;
    this.highlightedIndex.update((current) => (current + delta + length) % length);
  }

  private navigate(commands: string[]): void {
    void this.router.navigate(commands);
    this.paletteService.close();
  }

  private runAction(fn: () => void): void {
    fn();
    this.paletteService.close();
  }

  /** Single listener for both the global Ctrl/Cmd+K shortcut and in-palette keyboard interaction — keydown bubbles to document regardless of which element (including the search input) has focus. */
  onGlobalKeydown(event: KeyboardEvent): void {
    const isToggleShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (isToggleShortcut) {
      event.preventDefault();
      this.paletteService.toggle();
      return;
    }
    if (!this.paletteService.isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.paletteService.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveHighlight(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.activateHighlighted();
    } else if (event.key === 'Tab') {
      this.trapTab(event);
    }
  }

  /** Manual focus trap, same technique as new-task-dialog.ts — two occurrences don't justify extracting a shared helper yet. */
  private trapTab(event: KeyboardEvent): void {
    const ref = this.paletteRef();
    if (!ref) return;
    const focusable = ref.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
