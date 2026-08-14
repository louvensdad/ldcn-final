import { Injectable, signal } from '@angular/core';

/**
 * Shared open/close state for the global command palette (doc 44 F10 / doc 47).
 * TopbarComponent (search button) and CommandPaletteComponent (Ctrl/Cmd+K listener + overlay)
 * are siblings under AppShellComponent — this is how they coordinate without a direct reference.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly isOpen = signal(false);

  /** Captured synchronously in open(), before any change detection/autofocus can move focus. */
  private lastFocusedElement: HTMLElement | null = null;

  open(): void {
    if (this.isOpen()) return;
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.lastFocusedElement?.focus();
    this.lastFocusedElement = null;
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }
}
