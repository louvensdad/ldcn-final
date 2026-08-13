import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from './error-mapper';

function errorResponse(status: number, body?: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, statusText: 'Error' });
}

describe('mapHttpError', () => {
  it.each([
    [401, 'AUTH', 'errors.401'],
    [403, 'PERMISSION', 'errors.403'],
    [409, 'CONFLICT', 'errors.409'],
    [429, 'RATE_LIMIT', 'errors.429'],
    [500, 'SERVER', 'errors.5xx'],
    [418, 'UNKNOWN', 'errors.unknown'],
  ] as const)('maps HTTP %i to category %s', (status, category, translationKey) => {
    const mapped = mapHttpError(errorResponse(status));
    expect(mapped.category).toBe(category);
    expect(mapped.translationKey).toBe(translationKey);
    expect(mapped.status).toBe(status);
  });

  it('extracts the domain error code from the response body when present', () => {
    const mapped = mapHttpError(errorResponse(409, { error: 'GENERATOR_COMMAND_CONFLICT' }));
    expect(mapped.code).toBe('GENERATOR_COMMAND_CONFLICT');
  });
});
