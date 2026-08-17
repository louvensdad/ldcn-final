import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { GitlabCredentialService } from '../integrations/gitlab/gitlab-credential.service';
import { GitlabPushService } from '../integrations/gitlab/gitlab-push.service';
import { WorkspaceService } from '../generation-engine/workspace.service';
import { ProcessRunnerService, RunCommandResult } from '../generation-engine/process-runner.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;
const TOKEN = 'glpat-realsecrettoken1234567890';

function installFakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const original = global.fetch;
  global.fetch = ((url: string, init?: RequestInit) => Promise.resolve(handler(url, init))) as unknown as typeof fetch;
  return () => { global.fetch = original; };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fakeRunner(results: Partial<RunCommandResult>[]): ProcessRunnerService {
  let call = 0;
  return {
    runCommand: async (command: string, args: string[]) => {
      const preset = results[call] ?? { exitCode: 0, logsExcerpt: '' };
      call++;
      const remoteArg = args.find((a) => a.includes(TOKEN));
      const echoedLog = remoteArg ? `${preset.logsExcerpt ?? ''}\nremote: ${remoteArg}` : (preset.logsExcerpt ?? '');
      return { command: `${command} ${args.join(' ')}`, exitCode: preset.exitCode ?? 0, durationMs: 5, logsExcerpt: echoedLog };
    },
    startLongRunning: () => { throw new Error('not used in this test'); },
    stop: () => {},
  } as unknown as ProcessRunnerService;
}

function fakeWorkspace(hasGitDir = false): WorkspaceService {
  return {
    workspacePathFor: (missionId: string) => `/fake/workspace/${missionId}`,
    pathExists: async () => hasGitDir,
  } as unknown as WorkspaceService;
}

(RUN_DB_TESTS ? describe : describe.skip)('GitlabPushService (Postgres, fake fetch + fake runner)', () => {
  let prisma: PrismaService;
  let credentials: GitlabCredentialService;
  let restoreFetch: () => void;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    credentials = new GitlabCredentialService(prisma);
  });

  afterEach(async () => {
    if (restoreFetch) restoreFetch();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedGenerationRun(missionId: string, overrides: { status?: string; deliveryEligible?: boolean; securityPassed?: boolean } = {}) {
    await prisma.missionGenerationRun.create({
      data: {
        id: randomUUID(), missionId, status: overrides.status ?? 'READY', targetKind: 'BACKEND', pluginId: 'stack.typescript.nestjs',
        workspacePath: `/fake/workspace/${missionId}`, downloadPath: `/fake/workspace/${missionId}.zip`,
        deliveryEligible: overrides.deliveryEligible ?? true, securityPassed: overrides.securityPassed ?? true,
      },
    });
  }

  async function cleanup(missionId: string) {
    await prisma.gitlabPush.deleteMany({ where: { missionId } });
    await prisma.missionGenerationRun.deleteMany({ where: { missionId } });
    await prisma.gitlabCredential.deleteMany({ where: { id: 'default' } });
  }

  it('nunca envia sem passar pelos mesmos gates reais do download (deliveryEligible/securityPassed)', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId, { deliveryEligible: false });
      const service = new GitlabPushService(prisma, fakeWorkspace(), fakeRunner([]), credentials);
      await expect(service.push(missionId, 'meu-repo', false)).rejects.toThrow('DELIVERY_NOT_ELIGIBLE');
    } finally {
      await cleanup(missionId);
    }
  });

  it('nunca envia sem o security gate real ter passado', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId, { securityPassed: false });
      const service = new GitlabPushService(prisma, fakeWorkspace(), fakeRunner([]), credentials);
      await expect(service.push(missionId, 'meu-repo', false)).rejects.toThrow('SECURITY_GATE_FAILED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('nunca envia sem uma credencial real configurada', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId);
      const service = new GitlabPushService(prisma, fakeWorkspace(), fakeRunner([]), credentials);
      await expect(service.push(missionId, 'meu-repo', false)).rejects.toThrow('GITLAB_NOT_CONFIGURED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('push real de sucesso: cria o projeto via API real, empurra com git real, e o token NUNCA aparece nos logs persistidos', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId);
      restoreFetch = installFakeFetch((url) => {
        if (url.includes('/user')) return jsonResponse({ username: 'gitlabuser' });
        if (url.includes('/projects')) return jsonResponse({ web_url: 'https://gitlab.com/gitlabuser/meu-repo' });
        throw new Error(`unexpected fetch to ${url}`);
      });
      await credentials.save(TOKEN);

      const runner = fakeRunner([{ exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 1 }, { exitCode: 0 }, { exitCode: 0 }]);
      const service = new GitlabPushService(prisma, fakeWorkspace(false), runner, credentials);
      const result = await service.push(missionId, 'meu-repo', false);

      expect(result.status).toBe('PUSHED');
      expect(result.repoUrl).toBe('https://gitlab.com/gitlabuser/meu-repo');
      expect(result.logsExcerpt).not.toBeNull();
      expect(result.logsExcerpt).not.toContain(TOKEN);
      expect(result.logsExcerpt).toContain('***');
    } finally {
      await cleanup(missionId);
    }
  });

  it('"git remote remove gitlab" falhando na 1ª vez (remote ainda não existe) nunca derruba o push inteiro', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId);
      restoreFetch = installFakeFetch((url) => {
        if (url.includes('/projects')) return jsonResponse({ web_url: 'https://gitlab.com/gitlabuser/x' });
        return jsonResponse({ username: 'gitlabuser' });
      });
      await credentials.save(TOKEN);

      const runner = fakeRunner([{ exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 1 }, { exitCode: 0 }, { exitCode: 0 }]);
      const service = new GitlabPushService(prisma, fakeWorkspace(false), runner, credentials);
      const result = await service.push(missionId, 'meu-repo', false);
      expect(result.status).toBe('PUSHED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('falha real de um comando git (não o remove) marca FAILED de verdade, nunca finge sucesso', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId);
      restoreFetch = installFakeFetch((url) => {
        if (url.includes('/projects')) return jsonResponse({ web_url: 'https://gitlab.com/gitlabuser/x' });
        return jsonResponse({ username: 'gitlabuser' });
      });
      await credentials.save(TOKEN);

      const runner = fakeRunner([{ exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 0 }, { exitCode: 1 }, { exitCode: 0 }, { exitCode: 1 }]);
      const service = new GitlabPushService(prisma, fakeWorkspace(false), runner, credentials);
      const result = await service.push(missionId, 'meu-repo', false);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toContain('GITLAB_PUSH_COMMAND_FAILED');
    } finally {
      await cleanup(missionId);
    }
  });

  it('nome de projeto já existente (400 real da API) nunca é escondido como outro erro genérico', async () => {
    const missionId = `test-glpush-${randomUUID()}`;
    try {
      await seedGenerationRun(missionId);
      restoreFetch = installFakeFetch((url) => {
        if (url.includes('/projects')) return jsonResponse({ message: { name: ['has already been taken'] } }, 400);
        return jsonResponse({ username: 'gitlabuser' });
      });
      await credentials.save(TOKEN);

      const service = new GitlabPushService(prisma, fakeWorkspace(false), fakeRunner([]), credentials);
      const result = await service.push(missionId, 'meu-repo', false);
      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('GITLAB_REPO_NAME_TAKEN');
    } finally {
      await cleanup(missionId);
    }
  });
});
