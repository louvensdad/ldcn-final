import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'ldcn-api-key';

/**
 * Stand-in until the backend has real auth/tenancy (today it only enforces a single global
 * LDCN_API_KEY — see apps/api/src/security/api-key.guard.ts). This just holds that key and
 * gates the /login route; it is not a real authentication flow.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly apiKey = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  readonly isAuthenticated = computed(() => !!this.apiKey());

  signIn(apiKey: string): void {
    this.apiKey.set(apiKey);
    localStorage.setItem(STORAGE_KEY, apiKey);
  }

  signOut(): void {
    this.apiKey.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
