import { API_BASE_URL } from "./config";
import { getStoredApiKey } from "../auth/AuthContext";
import { mapFetchError, networkError, type AppError } from "./errors";

/**
 * Thin typed wrapper — every domain client (missionClient, generatorClient, ...) goes through
 * this instead of calling fetch directly, so the auth header and base URL live in one place.
 * Never call the Brain directly — everything goes through the Platform API.
 * Mirrors apps/web/src/app/core/api/api-client.ts.
 */
class ApiClientError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.code);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getStoredApiKey();
  const headers = new Headers(init.headers);
  if (apiKey) headers.set("x-api-key", apiKey);
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiClientError(networkError());
  }

  if (!response.ok) {
    throw new ApiClientError(await mapFetchError(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return request<T>(`${path}${query}`, { method: "GET" });
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

export { ApiClientError };
export type { AppError };
