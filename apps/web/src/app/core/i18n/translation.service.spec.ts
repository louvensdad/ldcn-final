import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  beforeEach(() => localStorage.clear());

  it('translates a known key in the current locale', () => {
    const service = TestBed.inject(TranslationService);
    service.setLocale('en');
    expect(service.translate('shell.home')).toBe('Home');
    service.setLocale('pt-BR');
    expect(service.translate('shell.home')).toBe('Início');
  });

  it('falls back to English, then to the raw key, for an unknown key', () => {
    const service = TestBed.inject(TranslationService);
    service.setLocale('fr');
    expect(service.translate('does.not.exist')).toBe('does.not.exist');
  });

  it('setLocale persists the choice to localStorage', () => {
    const service = TestBed.inject(TranslationService);
    service.setLocale('es');
    expect(localStorage.getItem('ldcn-locale')).toBe('es');
  });
});
