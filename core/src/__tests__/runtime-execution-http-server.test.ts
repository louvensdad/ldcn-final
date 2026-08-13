import { RuntimeExecutionHttpServer } from '../adapters/runtime-execution-http-server';
import { RuntimeLifecycleCoordinator } from '../services/runtime-lifecycle-coordinator';

describe('RuntimeExecutionHttpServer', () => {
  it('dispatches a validated command over HTTP', async () => {
    const coordinator = { dispatch: (input: { missionId: string }) => ({ id: 'd1', missionId: input.missionId, status: 'DISPATCHED' }) } as unknown as RuntimeLifecycleCoordinator;
    const server = new RuntimeExecutionHttpServer(coordinator);
    await server.listen(0);
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    const response = await fetch(`http://127.0.0.1:${address.port}/missions/m1/executions`, { method: 'POST', body: JSON.stringify({ decision: {}, context: {} }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ missionId: 'm1', status: 'DISPATCHED' });
    await server.close();
  });

  it('routes gate evaluation and repair advisory commands', async () => {
    const coordinator = {
      evaluateGates: () => ({ status: 'PASSED', id: 'g1' }),
      classifyAndAdviseRepair: (input: { approvedSolutionId: string }) => ({ snapshot: { id: 'f1' }, advisory: { approvedSolutionId: input.approvedSolutionId } }),
    } as unknown as RuntimeLifecycleCoordinator;
    const server = new RuntimeExecutionHttpServer(coordinator);
    await server.listen(0);
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    const base = `http://127.0.0.1:${address.port}/missions/m1`;
    const gate = await fetch(`${base}/gates`, { method: 'POST', body: JSON.stringify({ decision: {}, evidence: [] }) });
    expect(gate.status).toBe(200);
    expect(await gate.json()).toMatchObject({ status: 'PASSED' });
    const repair = await fetch(`${base}/repair-advisories`, { method: 'POST', body: JSON.stringify({ approvedSolutionId: 's1', snapshot: { missionId: 'm1' } }) });
    expect(repair.status).toBe(201);
    expect(await repair.json()).toMatchObject({ advisory: { approvedSolutionId: 's1' } });
    await server.close();
  });
});
