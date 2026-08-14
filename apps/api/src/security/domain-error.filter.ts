import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

const CONFLICT_CODES = new Set([
  'GENERATOR_COMMAND_CONFLICT',
  'GENERATOR_CONTEXT_STALE',
  'DECISION_EVENT_IDEMPOTENCY_CONFLICT',
  'LEARNING_OUTCOME_IDEMPOTENCY_CONFLICT',
  'ROUTING_DECISION_STALE',
  'TEAM_SWITCH_CONTEXT_STALE',
]);

const NOT_FOUND_CODES = new Set(['MISSION_NOT_FOUND']);

const SERVICE_UNAVAILABLE_CODES = new Set(['AI_EXPLANATION_UNAVAILABLE']);

/**
 * Normalizes errors raised by the framework-neutral core services (plain `Error` whose
 * message is a stable domain code, e.g. GENERATOR_COMMAND_CONFLICT) into HTTP responses.
 * Mirrors the mapping already used by core/src/adapters/generator-http-server.ts so both
 * transports behave the same way.
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({ error: exception.message });
      return;
    }

    const code = exception instanceof Error ? exception.message : 'INTERNAL_ERROR';
    const status = CONFLICT_CODES.has(code) ? 409 : NOT_FOUND_CODES.has(code) ? 404 : SERVICE_UNAVAILABLE_CODES.has(code) ? 503 : 400;
    response.status(status).json({ error: code });
  }
}
