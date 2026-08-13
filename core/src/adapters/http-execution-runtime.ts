import { ExecutionContextSnapshot } from '../domain';

export interface HttpExecutionRuntimeConfig {
  baseUrl: string;
  bearerToken?: string;
  fetchImpl?: typeof fetch;
}

/** Adapter for the existing LDCN execution service. It only transports validated commands. */
export interface AsyncExecutionRuntimePort {
  dispatch(input: { missionId: string; taskId: string; agentInstanceId: string; context: ExecutionContextSnapshot }): Promise<{ executionId: string }>;
  readStatus(input: { missionId: string; taskId: string; executionId: string }): Promise<{ status: 'RUNNING' | 'COMPLETED' | 'FAILED'; evidenceRefs?: string[]; durationMs?: number }>;
}

export class HttpExecutionRuntimeAdapter implements AsyncExecutionRuntimePort {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly config: HttpExecutionRuntimeConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    if (!this.baseUrl) throw new Error('RUNTIME_BASE_URL_REQUIRED');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  dispatch(input: { missionId: string; taskId: string; agentInstanceId: string; context: ExecutionContextSnapshot }): Promise<{ executionId: string }> {
    return this.request<{ executionId: string }>('/executions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  readStatus(input: { missionId: string; taskId: string; executionId: string }): Promise<{ status: 'RUNNING' | 'COMPLETED' | 'FAILED'; evidenceRefs?: string[]; durationMs?: number }> {
    return this.request(`/executions/${encodeURIComponent(input.executionId)}/status?missionId=${encodeURIComponent(input.missionId)}&taskId=${encodeURIComponent(input.taskId)}`, { method: 'GET' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.config.bearerToken) headers.set('authorization', `Bearer ${this.config.bearerToken}`);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const body = await response.text();
    if (!response.ok) throw new Error(`RUNTIME_HTTP_${response.status}`);
    let parsed: unknown;
    try { parsed = body ? JSON.parse(body) : undefined; } catch { throw new Error('RUNTIME_INVALID_JSON'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('RUNTIME_INVALID_RESPONSE');
    return parsed as T;
  }
}
