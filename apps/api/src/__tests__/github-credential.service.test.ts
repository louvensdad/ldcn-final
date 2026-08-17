import { PrismaService } from '../persistence/prisma.service';
import { GithubCredentialService } from '../integrations/github/github-credential.service';

const RUN_DB_TESTS = process.env.LDCN_TEST_DATABASE_URL || process.env.DATABASE_URL;

/** Nunca chama a API real do GitHub em teste automatizado — fetch fake controlado por teste. */
function installFakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const original = global.fetch;
  global.fetch = ((url: string, init?: RequestInit) => Promise.resolve(handler(url, init))) as unknown as typeof fetch;
  return () => { global.fetch = original; };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

(RUN_DB_TESTS ? describe : describe.skip)('GithubCredentialService (Postgres, fake fetch)', () => {
  let prisma: PrismaService;
  let service: GithubCredentialService;
  let restoreFetch: () => void;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(() => {
    service = new GithubCredentialService(prisma);
  });

  afterEach(async () => {
    if (restoreFetch) restoreFetch();
    await prisma.githubCredential.deleteMany({ where: { id: 'default' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('nunca persiste um token sem validar contra a API real do GitHub primeiro', async () => {
    restoreFetch = installFakeFetch(() => jsonResponse({ login: 'octocat' }));
    const result = await service.save('ghp_faketoken123');
    expect(result).toEqual({ configured: true, githubLogin: 'octocat', tokenPreview: expect.any(String) });
    expect(result.tokenPreview).not.toContain('faketoken');
  });

  it('token inválido (401 da API real) nunca é persistido', async () => {
    restoreFetch = installFakeFetch(() => jsonResponse({ message: 'Bad credentials' }, 401));
    await expect(service.save('bad-token')).rejects.toThrow('GITHUB_TOKEN_INVALID');
    const stored = await prisma.githubCredential.findUnique({ where: { id: 'default' } });
    expect(stored).toBeNull();
  });

  it('falha de rede real nunca vira "token inválido" — erro distinto e honesto', async () => {
    restoreFetch = installFakeFetch(() => { throw new Error('network down'); });
    await expect(service.save('any-token')).rejects.toThrow('GITHUB_UNAVAILABLE');
  });

  it('token vazio nunca gasta uma chamada de rede', async () => {
    let called = false;
    restoreFetch = installFakeFetch(() => { called = true; return jsonResponse({ login: 'x' }); });
    await expect(service.save('   ')).rejects.toThrow('GITHUB_TOKEN_REQUIRED');
    expect(called).toBe(false);
  });

  it('get() nunca vaza o token — só o preview mascarado e o login', async () => {
    restoreFetch = installFakeFetch(() => jsonResponse({ login: 'octocat' }));
    await service.save('ghp_supersecrettoken1234567890');
    const view = await service.get();
    expect(view.configured).toBe(true);
    expect(view.githubLogin).toBe('octocat');
    expect(JSON.stringify(view)).not.toContain('supersecrettoken');
  });

  it('getDecryptedToken() faz round-trip real da criptografia (AES-256-GCM)', async () => {
    restoreFetch = installFakeFetch(() => jsonResponse({ login: 'octocat' }));
    await service.save('ghp_roundtriptoken');
    const { token, login } = await service.getDecryptedToken();
    expect(token).toBe('ghp_roundtriptoken');
    expect(login).toBe('octocat');
  });

  it('revoke() remove a credencial de verdade', async () => {
    restoreFetch = installFakeFetch(() => jsonResponse({ login: 'octocat' }));
    await service.save('ghp_x');
    await service.revoke();
    const view = await service.get();
    expect(view.configured).toBe(false);
  });

  it('getDecryptedToken() sem credencial configurada nunca finge um token vazio', async () => {
    await expect(service.getDecryptedToken()).rejects.toThrow('GITHUB_NOT_CONFIGURED');
  });
});
