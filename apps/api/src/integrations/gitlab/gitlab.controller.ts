import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GitlabCredentialService } from './gitlab-credential.service';
import { GitlabPushService } from './gitlab-push.service';

export interface SaveGitlabTokenInput {
  token: string;
}

export interface GitlabPushInput {
  repoName: string;
  private?: boolean;
}

/**
 * MISSÃO "GitLab real (push de verdade)" — mesmo padrão real das rotas do GitHub.
 */
@Controller('integrations/gitlab')
export class GitlabController {
  constructor(private readonly credentials: GitlabCredentialService) {}

  @Get()
  getCredential() {
    return this.credentials.get();
  }

  @Post()
  saveCredential(@Body() body: SaveGitlabTokenInput) {
    return this.credentials.save(body.token);
  }

  @Delete()
  async revokeCredential() {
    await this.credentials.revoke();
    return { revoked: true };
  }
}

@Controller('missions/:missionId/generation/gitlab')
export class MissionGitlabController {
  constructor(private readonly push: GitlabPushService) {}

  @Post()
  pushToGitlab(@Param('missionId') missionId: string, @Body() body: GitlabPushInput) {
    return this.push.push(missionId, body.repoName, body.private ?? false);
  }

  @Get()
  async getStatus(@Param('missionId') missionId: string) {
    const status = await this.push.getStatus(missionId);
    if (!status) throw new Error('GITLAB_PUSH_NOT_STARTED');
    return status;
  }
}
