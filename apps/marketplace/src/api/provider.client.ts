import { apiClient } from "./client";

/** apps/api ProvidersController — real, backend-verified AI provider status. */
export interface ProviderDto {
  provider: string;
  displayName: string;
  configured: boolean;
  source: "workspace" | "server" | "none";
  keyPreview: string | null;
  model: string;
  status: "connected" | "failed" | "untested" | "unconfigured";
  lastTestedAt: string | null;
  usage: { calls: number; totalTokens: number };
}

export interface TestResultDto {
  success: boolean;
  latencyMs?: number;
  model?: string;
  reason?: string;
}

export const providerClient = {
  list(): Promise<ProviderDto[]> {
    return apiClient.get<ProviderDto[]>("/providers");
  },
  save(provider: string, apiKey: string, model?: string): Promise<ProviderDto> {
    return apiClient.post<ProviderDto>(`/providers/${provider}/credential`, { apiKey, model });
  },
  test(provider: string): Promise<TestResultDto> {
    return apiClient.post<TestResultDto>(`/providers/${provider}/credential/test`, {});
  },
  revoke(provider: string): Promise<ProviderDto> {
    return apiClient.delete<ProviderDto>(`/providers/${provider}/credential`);
  },
};
