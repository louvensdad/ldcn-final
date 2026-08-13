import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
}

/** No environment.ts files in this scaffold (Angular 22 dropped them from `ng new` by default) — a factory default is enough for this foundation slice. */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  factory: () => ({ baseUrl: 'http://127.0.0.1:3000' }),
});
