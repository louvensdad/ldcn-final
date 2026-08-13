import { IncomingMessage, ServerResponse } from 'node:http';

export interface HttpSecurityOptions { apiKey?: string; rateLimitPerMinute?: number; }

export class HttpSecurityGuard {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();
  constructor(private readonly options: HttpSecurityOptions = {}) {}

  authorize(request: IncomingMessage, response: ServerResponse): boolean {
    if (this.options.apiKey) {
      const provided = request.headers['x-api-key'] ?? (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined);
      if (provided !== this.options.apiKey) { this.reject(response, 401, 'UNAUTHORIZED'); return false; }
    }
    const limit = this.options.rateLimitPerMinute;
    if (limit !== undefined) {
      const key = request.socket.remoteAddress ?? 'unknown'; const now = Date.now(); const current = this.windows.get(key);
      const window = !current || now - current.startedAt >= 60_000 ? { startedAt: now, count: 0 } : current;
      window.count += 1; this.windows.set(key, window);
      if (window.count > limit) { response.setHeader('retry-after', '60'); this.reject(response, 429, 'RATE_LIMIT_EXCEEDED'); return false; }
    }
    return true;
  }

  private reject(response: ServerResponse, status: number, error: string): void { const body = JSON.stringify({ error }); response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }); response.end(body); }
}
