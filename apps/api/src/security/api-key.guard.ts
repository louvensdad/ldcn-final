import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Mirrors core/src/adapters/http-security.ts#HttpSecurityGuard so both transports enforce the
 * same rule: when LDCN_API_KEY is set, every request (except /health) must present it via
 * `x-api-key`, `Authorization: Bearer <key>`, or `?apiKey=` (the browser EventSource API used
 * for /stream cannot set custom headers, so SSE needs the query-param fallback).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey = process.env.LDCN_API_KEY;

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKey) return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path === '/health') return true;
    const bearer = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : undefined;
    const provided = (request.headers['x-api-key'] as string | undefined) ?? bearer ?? (request.query.apiKey as string | undefined);
    if (provided !== this.apiKey) throw new UnauthorizedException('UNAUTHORIZED');
    return true;
  }
}
