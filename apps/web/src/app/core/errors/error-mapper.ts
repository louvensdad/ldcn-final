import { HttpErrorResponse } from '@angular/common/http';

export type ErrorCategory = 'AUTH' | 'PERMISSION' | 'CONFLICT' | 'RATE_LIMIT' | 'SERVER' | 'UNKNOWN';

/** doc 40 §10 (global interceptor) + doc 42 §13 (domain code -> localized message -> recommended action). */
export interface AppError {
  category: ErrorCategory;
  status: number;
  code: string;
  translationKey: string;
}

export function mapHttpError(error: HttpErrorResponse): AppError {
  const code = typeof error.error?.error === 'string' ? error.error.error : error.statusText;
  if (error.status === 401) return { category: 'AUTH', status: 401, code, translationKey: 'errors.401' };
  if (error.status === 403) return { category: 'PERMISSION', status: 403, code, translationKey: 'errors.403' };
  if (error.status === 409) return { category: 'CONFLICT', status: 409, code, translationKey: 'errors.409' };
  if (error.status === 429) return { category: 'RATE_LIMIT', status: 429, code, translationKey: 'errors.429' };
  if (error.status >= 500) return { category: 'SERVER', status: error.status, code, translationKey: 'errors.5xx' };
  return { category: 'UNKNOWN', status: error.status, code, translationKey: 'errors.unknown' };
}
