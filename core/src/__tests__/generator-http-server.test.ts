import { GeneratorHttpServer } from '../adapters/generator-http-server';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('GeneratorHttpServer', () => {
  let server: GeneratorHttpServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new GeneratorHttpServer();
    await server.listen(0);
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => server.close());

  it('accepts a generation command and returns the approved solution', async () => {
    const response = await fetch(`${baseUrl}/missions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ missionId: 'api-m1', rawUserIdea: 'Quero uma API REST com login.' }),
    });
    const result = await response.json() as { approvedSolution: { missionId: string } };
    expect(response.status).toBe(201);
    expect(result.approvedSolution.missionId).toBe('api-m1');

    const overview = await fetch(`${baseUrl}/missions/api-m1/overview`);
    expect(overview.status).toBe(200);
    expect(await overview.json()).toMatchObject({ missionId: 'api-m1', status: 'READY_FOR_EXECUTION' });

    const events = await fetch(`${baseUrl}/missions/api-m1/events`);
    expect(events.status).toBe(200);
    expect((await events.json() as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown mission overview', async () => {
    const response = await fetch(`${baseUrl}/missions/missing/overview`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'MISSION_NOT_FOUND' });
  });

  it('rejects malformed generation commands', async () => {
    const response = await fetch(`${baseUrl}/missions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toMatch(/position 1/);
  });

  it('exposes health and CORS preflight, while requiring JSON for commands', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('access-control-allow-origin')).toBe('*');

    const preflight = await fetch(`${baseUrl}/missions`, { method: 'OPTIONS' });
    expect(preflight.status).toBe(204);

    const invalidType = await fetch(`${baseUrl}/missions`, { method: 'POST', body: 'plain text' });
    expect(invalidType.status).toBe(415);
    expect(await invalidType.json()).toEqual({ error: 'CONTENT_TYPE_MUST_BE_JSON' });
  });

  it('returns conflict for the same mission with a different command', async () => {
    const first = { missionId: 'conflict-m1', rawUserIdea: 'Quero uma API.' };
    await fetch(`${baseUrl}/missions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(first) });
    const response = await fetch(`${baseUrl}/missions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...first, rawUserIdea: 'Quero um app mobile.' }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'GENERATOR_COMMAND_CONFLICT' });
  });

  it('recovers generated missions when a new server uses the same persistence directory', async () => {
    const directory = join(mkdtempSync(join(tmpdir(), 'ldcn-http-persist-')), 'data');
    const first = new GeneratorHttpServer(undefined, { persistenceDirectory: directory });
    await first.listen(0);
    const firstAddress = first.server.address();
    if (!firstAddress || typeof firstAddress === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    const firstUrl = `http://127.0.0.1:${firstAddress.port}`;
    const created = await fetch(`${firstUrl}/missions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ missionId: 'persisted-http', rawUserIdea: 'Quero uma API.' }) });
    await created.text();
    await first.close();

    const second = new GeneratorHttpServer(undefined, { persistenceDirectory: directory });
    await second.listen(0);
    const secondAddress = second.server.address();
    if (!secondAddress || typeof secondAddress === 'string') throw new Error('TEST_SERVER_NOT_STARTED');
    const response = await fetch(`http://127.0.0.1:${secondAddress.port}/missions/persisted-http/overview`);
    expect(response.status).toBe(200);
    expect((await response.json() as { missionId: string }).missionId).toBe('persisted-http');
    await second.close();
  });
});
