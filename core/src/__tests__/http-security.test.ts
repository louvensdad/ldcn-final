import { HttpSecurityGuard } from '../adapters/http-security';
import { PassThrough } from 'node:stream';

function request(headers: Record<string, string> = {}) { const value = new PassThrough() as unknown as import('node:http').IncomingMessage; value.headers = headers; Object.defineProperty(value, 'socket', { value: { remoteAddress: 'test-client' } }); return value; }
function response() { const headers = new Map<string, string>(); let status = 0; return { value: { setHeader: (key: string, value: string) => headers.set(key, value), writeHead: (code: number) => { status = code; }, end: () => undefined } as never, status: () => status }; }

describe('HttpSecurityGuard', () => {
  it('requires API key and applies rate limiting', () => {
    const guard = new HttpSecurityGuard({ apiKey: 'key', rateLimitPerMinute: 1 });
    const unauthorized = response();
    expect(guard.authorize(request(), unauthorized.value)).toBe(false);
    expect(unauthorized.status()).toBe(401);
    expect(guard.authorize(request({ 'x-api-key': 'key' }), response().value)).toBe(true);
    const limited = response();
    expect(guard.authorize(request({ 'x-api-key': 'key' }), limited.value)).toBe(false);
    expect(limited.status()).toBe(429);
  });
});
