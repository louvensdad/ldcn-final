export type ErrorCategory = "AUTH" | "PERMISSION" | "CONFLICT" | "RATE_LIMIT" | "SERVER" | "UNKNOWN" | "NETWORK";

/** Mirrors apps/web/src/app/core/errors/error-mapper.ts so both frontends localize errors the same way. */
export interface AppError {
  category: ErrorCategory;
  status: number;
  code: string;
  translationKey: string;
}

export async function mapFetchError(response: Response): Promise<AppError> {
  let code = response.statusText;
  try {
    const body = (await response.clone().json()) as { error?: string };
    if (typeof body.error === "string") code = body.error;
  } catch {
    // body wasn't JSON — keep statusText
  }

  const status = response.status;
  if (status === 401) return { category: "AUTH", status, code, translationKey: "errors.401" };
  if (status === 403) return { category: "PERMISSION", status, code, translationKey: "errors.403" };
  if (status === 409) return { category: "CONFLICT", status, code, translationKey: "errors.409" };
  if (status === 429) return { category: "RATE_LIMIT", status, code, translationKey: "errors.429" };
  if (status >= 500) return { category: "SERVER", status, code, translationKey: "errors.5xx" };
  return { category: "UNKNOWN", status, code, translationKey: "errors.unknown" };
}

export function networkError(): AppError {
  return { category: "NETWORK", status: 0, code: "NETWORK_ERROR", translationKey: "errors.5xx" };
}
