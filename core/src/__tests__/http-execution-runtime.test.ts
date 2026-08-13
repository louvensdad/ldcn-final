import { HttpExecutionRuntimeAdapter } from '../adapters/http-execution-runtime';

describe('HttpExecutionRuntimeAdapter', () => {
  it('dispatches and reads status with mission/task context and bearer auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(url.endsWith('/status?missionId=m1&taskId=t1')
        ? JSON.stringify({ status: 'COMPLETED', durationMs: 12 })
        : JSON.stringify({ executionId: 'e1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const adapter = new HttpExecutionRuntimeAdapter({ baseUrl: 'https://runtime.local/', bearerToken: 'token', fetchImpl });

    await expect(adapter.dispatch({ missionId: 'm1', taskId: 't1', agentInstanceId: 'a1', context: {} as never })).resolves.toEqual({ executionId: 'e1' });
    await expect(adapter.readStatus({ missionId: 'm1', taskId: 't1', executionId: 'e1' })).resolves.toEqual({ status: 'COMPLETED', durationMs: 12 });
    expect(calls[0].url).toBe('https://runtime.local/executions');
    expect((calls[0].init?.headers as Headers).get('authorization')).toBe('Bearer token');
    expect(calls[0].init?.method).toBe('POST');
  });

  it('surfaces runtime HTTP and payload errors', async () => {
    const response = (async () => new Response('bad', { status: 502 })) as typeof fetch;
    const adapter = new HttpExecutionRuntimeAdapter({ baseUrl: 'https://runtime.local', fetchImpl: response });
    await expect(adapter.readStatus({ missionId: 'm1', taskId: 't1', executionId: 'e1' })).rejects.toThrow('RUNTIME_HTTP_502');
  });
});
