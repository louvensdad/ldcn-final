import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('is not authenticated until signIn() is called', () => {
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
    service.signIn('secret-key');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.apiKey()).toBe('secret-key');
    expect(localStorage.getItem('ldcn-api-key')).toBe('secret-key');
  });

  it('signOut() clears the stored key', () => {
    const service = TestBed.inject(AuthService);
    service.signIn('secret-key');
    service.signOut();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ldcn-api-key')).toBeNull();
  });
});
