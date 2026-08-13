import { RuntimeApiController } from '../services/runtime-api-controller';
import { RuntimeHttpServer } from '../adapters/runtime-http-server';

describe('RuntimeHttpServer', () => {
  let server: RuntimeHttpServer;
  let baseUrl: string;

  beforeEach(async () => {
    const controller = new RuntimeApiController({
      getOperationalMissionOverview: (missionId: string) => ({ missionId, runtimeTaskCount: 0, runningTaskCount: 0, failedTaskCount: 0, reviewPendingCount: 0, repairPendingCount: 0, retryPendingCount: 0 }),
      getOperationalActions: () => [], getRuntimeMissionOverview: () => [], getRepairMissionOverview: () => [],
      getRuntimeTaskOverview: () => undefined, getRepairOverview: () => undefined,
      getRuntimeEvents: () => [], getRepairEvents: () => [],
    } as never);
    server = new RuntimeHttpServer(controller);
    await server.listen(0);
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => server.close());

  it('serves mission runtime and rejects unsupported routes', async () => {
    const mission = await fetch(`${baseUrl}/missions/m1/runtime`);
    expect(mission.status).toBe(200);
    expect(await mission.json()).toMatchObject({ overview: { missionId: 'm1' } });

    const missing = await fetch(`${baseUrl}/unknown`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects non-GET requests', async () => {
    const response = await fetch(`${baseUrl}/missions/m1/runtime`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'METHOD_NOT_ALLOWED' });
  });
});
