import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GithubCredentialService } from './github-credential.service';
import { GithubPushService } from './github-push.service';

export interface SaveGithubTokenInput {
  token: string;
}

export interface GithubPushInput {
  repoName: string;
  private?: boolean;
}

/**
 * MISSÃO "GitHub real (push de verdade)" — substitui o botão "não configurado" do Delivery
 * Center por um fluxo real: token real validado contra a API do GitHub, repositório real criado,
 * push real do workspace gerado.
 */
@Controller('integrations/github')
export class GithubController {
  constructor(
    private readonly credentials: GithubCredentialService,
    private readonly push: GithubPushService
  ) {}

  @Get()
  getCredential() {
    return this.credentials.get();
  }

  @Post()
  saveCredential(@Body() body: SaveGithubTokenInput) {
    return this.credentials.save(body.token);
  }

  @Delete()
  async revokeCredential() {
    await this.credentials.revoke();
    return { revoked: true };
  }
}

@Controller('missions/:missionId/generation/github')
export class MissionGithubController {
  constructor(private readonly push: GithubPushService) {}

  @Post()
  pushToGithub(@Param('missionId') missionId: string, @Body() body: GithubPushInput) {
    return this.push.push(missionId, body.repoName, body.private ?? false);
  }

  @Get()
  async getStatus(@Param('missionId') missionId: string) {
    const status = await this.push.getStatus(missionId);
    if (!status) throw new Error('GITHUB_PUSH_NOT_STARTED');
    return status;
  }
}
