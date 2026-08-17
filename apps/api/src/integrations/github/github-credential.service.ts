import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { encryptCredential, decryptCredential, maskCredential } from '../../security/credential-crypto';

export interface GithubCredentialView {
  configured: boolean;
  githubLogin: string | null;
  tokenPreview: string | null;
}

const GITHUB_API = 'https://api.github.com';

/**
 * MISSÃO "GitHub real (push de verdade)" — mesma criptografia real já usada para credenciais de
 * provedor de LLM (AES-256-GCM, ver security/credential-crypto.ts), mas um modelo próprio: um
 * token do GitHub não tem "model" nem uso por token como um provedor de IA. Um único registro
 * global — este app não é multi-tenant (mesmo padrão de ProviderCredential).
 */
@Injectable()
export class GithubCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<GithubCredentialView> {
    const row = await this.prisma.githubCredential.findUnique({ where: { id: 'default' } });
    if (!row) return { configured: false, githubLogin: null, tokenPreview: null };
    return { configured: true, githubLogin: row.githubLogin, tokenPreview: row.tokenPreview };
  }

  /** Nunca aceita o token sem validar contra a API real do GitHub primeiro — nunca persiste um
   * token que não prova ser real. */
  async save(token: string): Promise<GithubCredentialView> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error('GITHUB_TOKEN_REQUIRED');

    const login = await this.validateToken(trimmed);

    await this.prisma.githubCredential.upsert({
      where: { id: 'default' },
      create: { id: 'default', encryptedToken: encryptCredential(trimmed), tokenPreview: maskCredential(trimmed), githubLogin: login },
      update: { encryptedToken: encryptCredential(trimmed), tokenPreview: maskCredential(trimmed), githubLogin: login },
    });
    return this.get();
  }

  async revoke(): Promise<void> {
    await this.prisma.githubCredential.deleteMany({ where: { id: 'default' } });
  }

  /** Nunca exposto fora do backend — só usado internamente pelo push real. */
  async getDecryptedToken(): Promise<{ token: string; login: string }> {
    const row = await this.prisma.githubCredential.findUnique({ where: { id: 'default' } });
    if (!row) throw new Error('GITHUB_NOT_CONFIGURED');
    return { token: decryptCredential(row.encryptedToken), login: row.githubLogin };
  }

  private async validateToken(token: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${GITHUB_API}/user`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ldcn-os' } });
    } catch {
      throw new Error('GITHUB_UNAVAILABLE');
    }
    if (!response.ok) throw new Error('GITHUB_TOKEN_INVALID');
    const body = (await response.json()) as { login?: string };
    if (!body.login) throw new Error('GITHUB_TOKEN_INVALID');
    return body.login;
  }
}
