import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ldcn-theme';

/**
 * Mirrors the token contract in src/styles/tokens.scss: 'system' means no [data-theme]
 * attribute (bare :root + prefers-color-scheme decides), 'light'/'dark' force it explicitly.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemePreference>(this.readStored());

  constructor() {
    this.apply(this.theme());
  }

  setTheme(theme: ThemePreference): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.apply(theme);
  }

  toggle(): void {
    const current = this.theme();
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const effectiveDark = current === 'dark' || (current === 'system' && prefersDark);
    this.setTheme(effectiveDark ? 'light' : 'dark');
  }

  private apply(theme: ThemePreference): void {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }

  private readStored(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }
}
