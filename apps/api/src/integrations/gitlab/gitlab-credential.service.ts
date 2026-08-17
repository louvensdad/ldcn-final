import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { encryptCredential, decryptCredential, maskCredential } from '../../security/credential-crypto';

export interface GitlabCredentialView {
  configured: boolean;
  gitlabUsername: string | null;
  tokenPreview: string | null;
}

const GITLAB_API = 'https://gitlab.com/api/v4';

/**
 * MISSÃO "GitLab real (push de verdade)" — mesmo padrão real do GithubCredentialService (mesma
 * criptografia real, AES-256-GCM), mas modelo próprio: a API do GitLab autentica com o header
 * `PRIVATE-TOKEN`, não `Authorization: Bearer` — formas diferentes o suficiente para nunca forçar
 * o mesmo código a servir os dois provedores.
 */
@Injectable()
export class GitlabCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<GitlabCredentialView> {
    const row = await this.prisma.gitlabCredential.findUnique({ where: { id: 'default' } });
    if (!row) return { configured: false, gitlabUsername: null, tokenPreview: null };
    return { configured: true, gitlabUsername: row.gitlabUsername, tokenPreview: row.tokenPreview };
  }

  async save(token: string): Promise<GitlabCredentialView> {
    const trimmed = token.trim();
    if (!trimmed) throw new Error('GITLAB_TOKEN_REQUIRED');

    const username = await this.validateToken(trimmed);

    await this.prisma.gitlabCredential.upsert({
      where: { id: 'default' },
      create: { id: 'default', encryptedToken: encryptCredential(trimmed), tokenPreview: maskCredential(trimmed), gitlabUsername: username },
      update: { encryptedToken: encryptCredential(trimmed), tokenPreview: maskCredential(trimmed), gitlabUsername: username },
    });
    return this.get();
  }

  async revoke(): Promise<void> {
    await this.prisma.gitlabCredential.deleteMany({ where: { id: 'default' } });
  }

  async getDecryptedToken(): Promise<{ token: string; username: string }> {
    const row = await this.prisma.gitlabCredential.findUnique({ where: { id: 'default' } });
    if (!row) throw new Error('GITLAB_NOT_CONFIGURED');
    return { token: decryptCredential(row.encryptedToken), username: row.gitlabUsername };
  }

  private async validateToken(token: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${GITLAB_API}/user`, { headers: { 'PRIVATE-TOKEN': token, 'User-Agent': 'ldcn-os' } });
    } catch {
      throw new Error('GITLAB_UNAVAILABLE');
    }
    if (!response.ok) throw new Error('GITLAB_TOKEN_INVALID');
    const body = (await response.json()) as { username?: string };
    if (!body.username) throw new Error('GITLAB_TOKEN_INVALID');
    return body.username;
  }
}
