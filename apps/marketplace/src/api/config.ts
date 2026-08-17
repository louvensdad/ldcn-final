/** Same default as apps/web/src/app/core/api/api-config.ts — no per-env files in this scaffold yet. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:3000";
