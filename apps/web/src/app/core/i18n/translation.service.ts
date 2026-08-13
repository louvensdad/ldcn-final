import { Injectable, computed, signal } from '@angular/core';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export type Locale = 'pt-BR' | 'en' | 'es' | 'fr';

export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en', 'es', 'fr'];

const DICTIONARIES: Record<Locale, Record<string, string>> = { 'pt-BR': ptBR, en, es, fr };
const STORAGE_KEY = 'ldcn-locale';

/**
 * Runtime, signal-based i18n (doc 44 F0 asks for "i18n infrastructure", not full translations
 * yet). Deliberately not @angular/localize: that compiles a separate bundle per locale at
 * build time, which is more than this foundation slice needs — switching languages here is
 * instant, no rebuild, easy to swap for @angular/localize later if per-locale bundles matter.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly locale = signal<Locale>(this.detectInitial());
  private readonly dictionary = computed(() => DICTIONARIES[this.locale()]);

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    localStorage.setItem(STORAGE_KEY, locale);
  }

  translate(key: string): string {
    return this.dictionary()[key] ?? DICTIONARIES.en[key] ?? key;
  }

  private detectInitial(): Locale {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale;
    const browserLanguage = navigator.language;
    if (browserLanguage.startsWith('pt')) return 'pt-BR';
    if (browserLanguage.startsWith('es')) return 'es';
    if (browserLanguage.startsWith('fr')) return 'fr';
    return 'en';
  }
}
