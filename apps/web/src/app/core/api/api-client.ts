import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api-config';
import { AuthService } from '../auth/auth.service';

/**
 * Thin typed wrapper (doc 40 §5): every domain client (MissionClient, GeneratorClient, ...)
 * goes through this instead of injecting HttpClient directly, so auth headers and the base
 * URL live in exactly one place. Never call the Brain directly — everything goes through the
 * Platform API (doc 42 rule).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly auth = inject(AuthService);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<T>(this.url(path), { headers: this.headers(), params: this.toHttpParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body, { headers: this.headers() });
  }

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  private headers(): HttpHeaders {
    const apiKey = this.auth.apiKey();
    return apiKey ? new HttpHeaders({ 'x-api-key': apiKey }) : new HttpHeaders();
  }

  private toHttpParams(params?: Record<string, string>): HttpParams | undefined {
    return params ? Object.entries(params).reduce((acc, [key, value]) => acc.set(key, value), new HttpParams()) : undefined;
  }
}
